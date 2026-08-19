import { assertEquals, assertFalse } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";

const administrator = "notifications-admin";
const invited = "notifications-invited";
const other = "notifications-other";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, invited, other]));

/** An administrator with a group, having invited someone who has not accepted yet. */
async function invitation() {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Der Erinnerungsmarkt");
  const invitedCookie = await registerUser(invited);
  const invitedId = await getUserId(invited);

  const response = await request(
    "POST",
    `/api/groups/${group.id}/memberships`,
    adminCookie,
    { userId: invitedId, role: "writer" },
  );
  assertEquals(response.status, STATUS_CODE.Created);

  return { adminCookie, invitedCookie, invitedId, group };
}

async function list(cookie: string, body: unknown = {}) {
  const response = await request("QUERY", "/api/notifications", cookie, body);
  assertEquals(response.status, STATUS_CODE.OK);
  return await response.json();
}

Deno.test("an invitation tells the invited member", async () => {
  const { invitedCookie, group } = await invitation();

  const page = await list(invitedCookie);

  assertEquals(page.totalResults, 1);
  const [notification] = page.results;
  assertEquals(notification.type, "invited_to_writing_group");
  assertEquals(notification.actorUsername, administrator);
  assertEquals(notification.writingGroupId, group.id);
  // Joined at read time, so a renamed group renames here too.
  assertEquals(notification.writingGroupTitle, "Der Erinnerungsmarkt");
  assertEquals(notification.readAt, null);
});

Deno.test("the administrator is not told about their own invitation", async () => {
  const { adminCookie } = await invitation();

  assertEquals((await list(adminCookie)).totalResults, 0);
});

Deno.test("a member sees nothing of another group's notifications", async () => {
  await invitation();
  const outsiderCookie = await registerUser(other);

  assertEquals((await list(outsiderCookie)).totalResults, 0);
});

Deno.test("the unread count is reported with the current user", async () => {
  const { invitedCookie } = await invitation();

  const before = await (await request("GET", "/api/auth/me", invitedCookie))
    .json();
  assertEquals(before.unreadNotifications, 1);

  const read = await request("POST", "/api/notifications/read", invitedCookie);
  assertEquals(read.status, STATUS_CODE.OK);
  assertEquals((await read.json()).read, 1);

  const after = await (await request("GET", "/api/auth/me", invitedCookie))
    .json();
  assertEquals(after.unreadNotifications, 0);
  // The notification itself stays; only its unread state changed.
  assertEquals((await list(invitedCookie)).totalResults, 1);
});

Deno.test("unreadOnly leaves out what has been read", async () => {
  const { invitedCookie } = await invitation();
  await request("POST", "/api/notifications/read", invitedCookie);

  assertEquals(
    (await list(invitedCookie, { unreadOnly: true })).totalResults,
    0,
  );
  assertEquals((await list(invitedCookie)).totalResults, 1);
});

Deno.test("withdrawing the invitation takes the notification with it", async () => {
  const { adminCookie, invitedCookie, invitedId, group } = await invitation();

  const removed = await request(
    "DELETE",
    `/api/groups/${group.id}/memberships/${invitedId}`,
    adminCookie,
  );
  assertEquals(removed.status, STATUS_CODE.OK);

  // Nothing announces an invitation that no longer exists.
  assertEquals((await list(invitedCookie)).totalResults, 0);
});

Deno.test("QUERY /api/notifications needs a session", async () => {
  const response = await request("QUERY", "/api/notifications", "", {});

  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertFalse(response.headers.has("set-cookie"));
});
