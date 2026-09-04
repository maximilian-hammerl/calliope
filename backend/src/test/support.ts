/**
 * Fixtures shared across the suite. Everything in `test/` is test-only: files ending in
 * `_test.ts` announce themselves, these do not, so the directory says it instead of the name.
 */
import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import app from "@/src/app.ts";
import { db } from "@/src/database/client.ts";
import { redis } from "@/src/redis/client.ts";
import { RATE_LIMIT_KEY_PREFIX } from "@/src/middleware/rate_limit.ts";
import "@/src/test/breach_check.ts";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import type { PostDocument } from "@/src/document/document_schema.ts";

/**
 * Registers a user, confirms their address, and returns the session cookie.
 *
 * The confirmation is part of the fixture because almost every test is about something else,
 * and an unverified member is refused by every gated route. Tests that are *about* verification
 * register through the app by hand instead — see `route/auth/`.
 */
export async function registerUser(username: string): Promise<string> {
  const response = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      password: "a-complex-password",
      emailAddress: `${username}@example.com`,
    }),
  });

  const setCookie = response.headers.get("set-cookie");
  assertExists(setCookie, `could not register ${username}`);

  await db
    .updateTable("user")
    .set({ emailAddressVerifiedAt: Temporal.Now.instant().toString() })
    .where("username", "=", username)
    .execute();

  return setCookie.split(";")[0] ?? setCookie;
}

/** `csrf()` refuses a write carrying neither a JSON content type nor the header a browser sets. */
export const SAME_ORIGIN = { "sec-fetch-site": "same-origin" };

export async function request(
  method: string,
  path: string,
  cookie: string,
  body?: unknown,
): Promise<Response> {
  return await app.request(path, {
    method,
    headers: { cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function getUserId(username: string): Promise<string> {
  const user = await db
    .selectFrom("user")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirstOrThrow();

  return user.id;
}

/** Creates a group owned by the session's user, who becomes its administrator. */
export async function createGroup(
  cookie: string,
  title: string,
  visibility: "public" | "private" = "private",
): Promise<{ id: string }> {
  const response = await request("POST", "/api/groups", cookie, {
    title,
    synopsis: "d",
    visibility,
  });

  assertEquals(response.status, STATUS_CODE.Created);
  return await response.json();
}

/** Registers a user, invites them to the group with the given role, and accepts for them. */
export async function addMember(
  administratorCookie: string,
  groupId: string,
  username: string,
  role: "administrator" | "writer" | "reader",
): Promise<string> {
  const cookie = await registerUser(username);

  const invitation = await request(
    "POST",
    `/api/groups/${groupId}/memberships`,
    administratorCookie,
    { userId: await getUserId(username), role },
  );
  assertEquals(invitation.status, STATUS_CODE.Created);

  const acceptance = await request(
    "POST",
    `/api/groups/${groupId}/memberships/me/accept`,
    cookie,
  );
  assertEquals(acceptance.status, STATUS_CODE.OK);

  return cookie;
}

/**
 * Sessions and memberships cascade with the user, but groups do not — `created_by` is
 * nullable and set to null instead — so their groups have to go first.
 */
export async function deleteUsers(usernames: Array<string>): Promise<void> {
  const userIds = db
    .selectFrom("user")
    .select("id")
    .where("username", "in", usernames);

  await db.deleteFrom("writingGroup").where("createdBy", "in", userIds)
    .execute();
  await db.deleteFrom("user").where("username", "in", usernames).execute();
}

/**
 * Counters outlive the process, so the suite would eventually rate-limit itself.
 *
 * The limiter keys on the client address, so this leaves the middleware's own test alone: it
 * deliberately fills a window request by request, and a `beforeEach` here used to empty it
 * mid-loop, which read as the limiter simply not working.
 */
export const RATE_LIMIT_TEST_CLIENTS = "198.51.100.";

export async function clearRateLimits(): Promise<void> {
  const keys = (await redis.keys(`${RATE_LIMIT_KEY_PREFIX}*`))
    .filter((key) => !key.includes(RATE_LIMIT_TEST_CLIENTS));
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

/**
 * A post body from prose. Posts are stored as documents now, and a test that says what it writes
 * reads better than one carrying a node tree — the projection it asserts on comes back as `text`.
 */
export function postBody(
  text: string,
  rest: { isDraft?: boolean } = {},
): { document: PostDocument; isDraft?: boolean } {
  return { document: plainTextToDocument(text), ...rest };
}
