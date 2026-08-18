import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import app from "./app.ts";
import { db } from "./database/client.ts";
import { redis } from "./redis/client.ts";
import { RATE_LIMIT_KEY_PREFIX } from "./middleware/rate_limit.ts";

/** Registers a user and returns the session cookie to send back on later requests. */
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
  return setCookie.split(";")[0];
}

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
    description: "d",
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

/** Counters outlive the process, so the suite would eventually rate-limit itself. */
export async function clearRateLimits(): Promise<void> {
  const keys = await redis.keys(`${RATE_LIMIT_KEY_PREFIX}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}

/** A minimal valid post document holding one paragraph, for tests that only care about text. */
export function documentOf(text: string) {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}
