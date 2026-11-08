import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "#/src/http/status.ts";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
  request,
} from "#/src/test/support.ts";

const administrator = "notifications-admin";
const invited = "notifications-invited";
const other = "notifications-other";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([administrator, invited, other]));

/** An administrator with a group, having invited someone who has not accepted yet. */
async function invitation() {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Der Erinnerungsmarkt");
  const invitedCookie = await registerUser(invited);
  const invitedId = await getUserId(invited);

  const response = await request("POST", `/api/groups/${group.id}/memberships`, adminCookie, {
    userId: invitedId,
    role: "writer",
  });
  assert.equal(response.status, STATUS_CODE.Created);

  return { adminCookie, invitedCookie, invitedId, group };
}

async function list(cookie: string, body: unknown = {}) {
  const response = await request("QUERY", "/api/notifications", cookie, body);
  assert.equal(response.status, STATUS_CODE.OK);
  return await response.json();
}

test("an invitation tells the invited member", async () => {
  const { invitedCookie, group } = await invitation();

  const page = await list(invitedCookie);

  assert.equal(page.totalResults, 1);
  const [notification] = page.results;
  assert.equal(notification.type, "invited_to_writing_group");
  assert.equal(notification.actorUsername, administrator);
  assert.equal(notification.writingGroupId, group.id);
  // Joined at read time, so a renamed group renames here too.
  assert.equal(notification.writingGroupTitle, "Der Erinnerungsmarkt");
  assert.equal(notification.readAt, null);
});

test("the administrator is not told about their own invitation", async () => {
  const { adminCookie } = await invitation();

  assert.equal((await list(adminCookie)).totalResults, 0);
});

test("a member sees nothing of another group's notifications", async () => {
  await invitation();
  const outsiderCookie = await registerUser(other);

  assert.equal((await list(outsiderCookie)).totalResults, 0);
});

test("the unread count is reported with the current user", async () => {
  const { invitedCookie } = await invitation();

  const before = await (await request("GET", "/api/auth/me", invitedCookie)).json();
  assert.equal(before.unreadNotifications, 1);

  const read = await request("POST", "/api/notifications/read", invitedCookie);
  assert.equal(read.status, STATUS_CODE.OK);
  assert.equal((await read.json()).read, 1);

  const after = await (await request("GET", "/api/auth/me", invitedCookie)).json();
  assert.equal(after.unreadNotifications, 0);
  // The notification itself stays; only its unread state changed.
  assert.equal((await list(invitedCookie)).totalResults, 1);
});

test("unreadOnly leaves out what has been read", async () => {
  const { invitedCookie } = await invitation();
  await request("POST", "/api/notifications/read", invitedCookie);

  assert.equal((await list(invitedCookie, { unreadOnly: true })).totalResults, 0);
  assert.equal((await list(invitedCookie)).totalResults, 1);
});

test("withdrawing the invitation takes the notification with it", async () => {
  const { adminCookie, invitedCookie, invitedId, group } = await invitation();

  const removed = await request(
    "DELETE",
    `/api/groups/${group.id}/memberships/${invitedId}`,
    adminCookie,
  );
  assert.equal(removed.status, STATUS_CODE.OK);

  // Nothing announces an invitation that no longer exists.
  assert.equal((await list(invitedCookie)).totalResults, 0);
});

test("QUERY /api/notifications needs a session", async () => {
  const response = await request("QUERY", "/api/notifications", "", {});

  assert.equal(response.status, STATUS_CODE.Unauthorized);
  assert.ok(!response.headers.has("set-cookie"));
});
