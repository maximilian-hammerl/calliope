import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { db } from "@/src/database/client.ts";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import { tokenFromMail, waitForMail } from "@/src/test/mailpit.ts";
import {
  authFixture,
  postJson,
  sendJson,
  sessionCookie,
} from "@/src/test/auth.ts";

// Its own account, so a file running beside this one cannot register or delete it.
const {
  clearMail,
  emailAddress,
  register,
  username,
} = authFixture("verify");

Deno.test.beforeEach(async () => {
  await clearRateLimits();
  await clearMail();
});
Deno.test.afterEach(() => deleteUsers([username]));

/** A gated route, to show what an unverified session may and may not reach. */
const listGroups = (cookie: string) =>
  sendJson("QUERY", "/api/groups", { page: 1, pageSize: 10 }, cookie);

const verify = (token: string) =>
  postJson("/api/auth/verify-email-address", { token });

async function registerAndReadLink(): Promise<
  { cookie: string; token: string }
> {
  const cookie = sessionCookie(await register());
  await flushBackgroundWork();
  return { cookie, token: tokenFromMail(await waitForMail(emailAddress)) };
}

Deno.test("registering leaves the address unverified and sends a link", async () => {
  const { token } = await registerAndReadLink();

  assertExists(token);
  const user = await db
    .selectFrom("user")
    .select(["emailAddressVerifiedAt"])
    .where("username", "=", username)
    .executeTakeFirstOrThrow();
  assertEquals(user.emailAddressVerifiedAt, null);
});

Deno.test("a gated route is refused until the address is verified", async () => {
  const { cookie, token } = await registerAndReadLink();

  const before = await listGroups(cookie);
  assertEquals(before.status, STATUS_CODE.Forbidden);
  assertEquals(await before.json(), { error: "Email address not verified" });

  assertEquals((await verify(token)).status, STATUS_CODE.OK);

  // The same session, unchanged — only the account's state moved.
  const after = await listGroups(cookie);
  assertEquals(after.status, STATUS_CODE.OK);
});

Deno.test("POST /api/auth/verify-email-address spends the token exactly once", async () => {
  const { token } = await registerAndReadLink();

  assertEquals((await verify(token)).status, STATUS_CODE.OK);

  const second = await verify(token);
  assertEquals(second.status, STATUS_CODE.Gone);
  assertEquals(await second.json(), { error: "The link is no longer valid" });
});

Deno.test("POST /api/auth/verify-email-address rejects an expired token", async () => {
  const { cookie, token } = await registerAndReadLink();

  await db
    .updateTable("userToken")
    .set({
      expiresAt: Temporal.Now.instant().subtract({ minutes: 1 }).toString(),
    })
    .where("purpose", "=", "email_address_verification")
    .execute();

  assertEquals((await verify(token)).status, STATUS_CODE.Gone);
  // Still walled, rather than let through by a link that no longer counts.
  assertEquals((await listGroups(cookie)).status, STATUS_CODE.Forbidden);
});

Deno.test("POST /api/auth/verify-email-address rejects a reset token", async () => {
  const { cookie } = await registerAndReadLink();
  await clearMail();

  await postJson("/api/auth/forgot-password", { login: username });
  await flushBackgroundWork();
  const resetToken = tokenFromMail(await waitForMail(emailAddress));

  // Purpose is part of the match: a token issued for one thing cannot be spent on another.
  assertEquals((await verify(resetToken)).status, STATUS_CODE.Gone);
  assertEquals((await listGroups(cookie)).status, STATUS_CODE.Forbidden);
});

Deno.test("POST /api/auth/resend-email-address-verification sends another link", async () => {
  const { cookie } = await registerAndReadLink();
  await clearMail();

  // Past the resend cooldown, which the issuing service enforces on the outstanding token.
  await db
    .updateTable("userToken")
    .set({
      createdAt: Temporal.Now.instant().subtract({ minutes: 5 }).toString(),
    })
    .where("purpose", "=", "email_address_verification")
    .execute();

  const response = await postJson(
    "/api/auth/resend-email-address-verification",
    undefined,
    cookie,
  );
  assertEquals(response.status, STATUS_CODE.OK);

  await flushBackgroundWork();
  assertEquals(
    (await verify(tokenFromMail(await waitForMail(emailAddress))))
      .status,
    STATUS_CODE.OK,
  );
});
