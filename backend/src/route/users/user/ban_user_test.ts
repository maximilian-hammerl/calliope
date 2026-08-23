import { assert, assertEquals, assertFalse } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { db } from "@/src/database/client.ts";
import app from "@/src/app.ts";
import { ACCOUNT_BANNED, INVALID_CREDENTIALS } from "@/src/http/response.ts";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";

// Its own accounts: the suite runs in parallel, so a shared name collides.
const operator = "ban-test-operator";
const offender = "ban-test-offender";
const bystander = "ban-test-bystander";

const PASSWORD = "a-complex-password";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([operator, offender, bystander]));

async function registerOperator(
  platformRole: "moderator" | "administrator" = "moderator",
): Promise<string> {
  const cookie = await registerUser(operator);
  await db
    .updateTable("user")
    .set({ platformRole })
    .where("username", "=", operator)
    .execute();
  return cookie;
}

const ban = (cookie: string, userId: string, reason = "Spam") =>
  request("POST", `/api/users/${userId}/ban`, cookie, { reason });

const liftBan = (cookie: string, userId: string) =>
  request("DELETE", `/api/users/${userId}/ban`, cookie, undefined);

/** Signing in by hand, because a session is exactly what a ban is supposed to refuse. */
async function signIn(login: string, password = PASSWORD): Promise<Response> {
  return await app.request("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login, password }),
  });
}

Deno.test("POST /api/users/{userId}/ban ends every session the account has", async () => {
  const operatorCookie = await registerOperator();
  const offenderCookie = await registerUser(offender);
  const offenderId = await getUserId(offender);

  // The session works before the ban, so the assertion after it means something.
  assertEquals(
    (await request("GET", "/api/auth/me", offenderCookie, undefined)).status,
    STATUS_CODE.OK,
  );

  assertEquals((await ban(operatorCookie, offenderId)).status, STATUS_CODE.OK);

  const sessions = await db
    .selectFrom("userSession")
    .select("id")
    .where("userId", "=", offenderId)
    .execute();
  assertEquals(sessions.length, 0, "the ban left a session alive");
});

Deno.test("a banned account is refused at sign-in, and told so", async () => {
  const operatorCookie = await registerOperator();
  await registerUser(offender);
  await ban(operatorCookie, await getUserId(offender));

  const response = await signIn(offender);

  assertEquals(response.status, STATUS_CODE.Forbidden);
  assertEquals((await response.json()).code, ACCOUNT_BANNED);
});

Deno.test("a wrong password on a banned account still says only invalid credentials", async () => {
  const operatorCookie = await registerOperator();
  await registerUser(offender);
  await ban(operatorCookie, await getUserId(offender));

  // The whole reason the ban is checked *after* the password: somebody guessing must not learn
  // that this address belongs to an account, banned or otherwise.
  const response = await signIn(offender, "not-the-password");

  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertEquals((await response.json()).code, INVALID_CREDENTIALS);
});

Deno.test("a session that outlived a ban is refused", async () => {
  const offenderCookie = await registerUser(offender);
  const offenderId = await getUserId(offender);

  // Banning deletes the sessions, so reach the middleware's own check by marking the row
  // directly — the state this guard exists for is one that should never occur.
  await db
    .updateTable("user")
    .set({ bannedAt: Temporal.Now.instant().toString(), banReason: "Spam" })
    .where("id", "=", offenderId)
    .execute();

  const response = await request(
    "GET",
    "/api/auth/me",
    offenderCookie,
    undefined,
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
  assertEquals((await response.json()).code, ACCOUNT_BANNED);
});

Deno.test("the banned address stays held, so it cannot register again", async () => {
  const operatorCookie = await registerOperator();
  await registerUser(offender);
  await ban(operatorCookie, await getUserId(offender));

  // This is the whole ban-is-not-a-deletion point: deleting frees the address, banning holds it.
  const response = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: `${offender}-again`,
      emailAddress: `${offender}@example.com`,
      password: PASSWORD,
    }),
  });

  assertEquals(response.status, STATUS_CODE.Conflict);
  await response.body?.cancel();
});

Deno.test("an operator cannot be banned", async () => {
  const operatorCookie = await registerOperator("administrator");
  await registerUser(bystander);
  await db
    .updateTable("user")
    .set({ platformRole: "moderator" })
    .where("username", "=", bystander)
    .execute();

  // Which also settles banning yourself: an operator holds a role, so an operator is unbannable
  // until an administrator revokes it.
  const response = await ban(operatorCookie, await getUserId(bystander));

  assertEquals(response.status, STATUS_CODE.Forbidden);
});

Deno.test("an ordinary member cannot ban anybody", async () => {
  const memberCookie = await registerUser(bystander);
  await registerUser(offender);

  const response = await ban(memberCookie, await getUserId(offender));

  assertEquals(response.status, STATUS_CODE.Forbidden);
});

Deno.test("lifting a ban restores sign-in", async () => {
  const operatorCookie = await registerOperator();
  await registerUser(offender);
  const offenderId = await getUserId(offender);

  await ban(operatorCookie, offenderId);
  assertEquals((await signIn(offender)).status, STATUS_CODE.Forbidden);

  assertEquals(
    (await liftBan(operatorCookie, offenderId)).status,
    STATUS_CODE.OK,
  );

  const response = await signIn(offender);
  assertEquals(response.status, STATUS_CODE.OK);
  await response.body?.cancel();
});

Deno.test("a banned account drops out of the member list and the search", async () => {
  const operatorCookie = await registerOperator();
  await registerUser(offender);
  const offenderId = await getUserId(offender);

  const listed = async () => {
    const response = await request("QUERY", "/api/users", operatorCookie, {
      search: offender,
      limit: 5,
      offset: 0,
    });
    return (await response.json()).results.map((u: { id: string }) => u.id);
  };
  const searched = async () => {
    const response = await request("QUERY", "/api/search", operatorCookie, {
      search: offender,
    });
    return (await response.json()).users.results.map((u: { id: string }) =>
      u.id
    );
  };

  assert((await listed()).includes(offenderId), "not listed before the ban");
  assert((await searched()).includes(offenderId), "not found before the ban");

  await ban(operatorCookie, offenderId);

  assertFalse((await listed()).includes(offenderId));
  assertFalse((await searched()).includes(offenderId));
});

Deno.test("a banned account's profile still answers", async () => {
  const operatorCookie = await registerOperator();
  await registerUser(offender);
  const offenderId = await getUserId(offender);
  await ban(operatorCookie, offenderId);

  // Deliberately unlike the lists: whoever already has the link — a group they wrote in, a
  // post of theirs — must still be able to see whose name that is.
  const response = await request(
    "GET",
    `/api/users/${offenderId}`,
    operatorCookie,
    undefined,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals((await response.json()).username, offender);
});

Deno.test("only an operator is told that an account is banned", async () => {
  const operatorCookie = await registerOperator();
  await registerUser(offender);
  const offenderId = await getUserId(offender);
  const memberCookie = await registerUser(bystander);
  await ban(operatorCookie, offenderId);

  const asOperator = await (await request(
    "GET",
    `/api/users/${offenderId}`,
    operatorCookie,
    undefined,
  )).json();
  const asMember = await (await request(
    "GET",
    `/api/users/${offenderId}`,
    memberCookie,
    undefined,
  )).json();

  assertEquals(asOperator.isBanned, true);
  // Absent, not false: an ordinary member is told nothing either way.
  assertFalse("isBanned" in asMember);
});

Deno.test("a banned account cannot be invited to a group", async () => {
  const operatorCookie = await registerOperator();
  await registerUser(offender);
  const offenderId = await getUserId(offender);
  await ban(operatorCookie, offenderId);

  const group = await createGroup(operatorCookie, "Einladungsprobe");

  // Without this the invitation succeeds and waits for ever: a banned account cannot sign in,
  // so it can never answer. The refusal is the same neutral one a block gives, so the inviter
  // learns nothing about a moderation action taken against somebody else.
  const response = await request(
    "POST",
    `/api/groups/${group.id}/memberships`,
    operatorCookie,
    { userId: offenderId, role: "writer" },
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
  assertEquals((await response.json()).error, "Contact is not possible");
});

Deno.test("banning an already banned account is a conflict", async () => {
  const operatorCookie = await registerOperator();
  await registerUser(offender);
  const offenderId = await getUserId(offender);

  assertEquals((await ban(operatorCookie, offenderId)).status, STATUS_CODE.OK);
  assertEquals(
    (await ban(operatorCookie, offenderId)).status,
    STATUS_CODE.Conflict,
  );
});
