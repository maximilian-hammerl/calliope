import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "#/src/http/status.ts";
import { plainTextToDocument } from "#/src/document/document_text.ts";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  postBody,
  registerUser,
  request,
} from "#/src/test/support.ts";

const administrator = "producers-admin";
const writer = "producers-writer";
const reader = "producers-reader";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([administrator, writer, reader]));

/** A group with an administrator and two members who have accepted. */
async function group() {
  const adminCookie = await registerUser(administrator);
  const created = await createGroup(adminCookie, "Der Erinnerungsmarkt");
  const writerCookie = await addMember(adminCookie, created.id, writer, "writer");
  const readerCookie = await addMember(adminCookie, created.id, reader, "reader");
  return { adminCookie, writerCookie, readerCookie, group: created };
}

async function notificationsOf(cookie: string) {
  const response = await request("QUERY", "/api/notifications", cookie, {
    limit: 50,
  });
  assert.equal(response.status, STATUS_CODE.OK);
  return (await response.json()).results as Array<{ type: string; actorUsername: string }>;
}

/** Only what these tests read, not the API's full union. */
type Notification = {
  type: string;
  actorUsername: string;
  writingPageId?: string;
  writingPageTitle?: string;
};

const ofType = (notifications: Notification[], type: string) =>
  notifications.filter((notification) => notification.type === type);

test("a new thread tells the group but not its author", async () => {
  const { adminCookie, writerCookie, readerCookie, group: created } = await group();

  const response = await request("POST", `/api/groups/${created.id}/threads`, writerCookie, {
    title: "Kapitel 1",
  });
  assert.equal(response.status, STATUS_CODE.Created);

  for (const cookie of [adminCookie, readerCookie]) {
    const [notification] = ofType(
      // oxlint-disable-next-line no-await-in-loop -- sequential on purpose, one case per iteration
      await notificationsOf(cookie),
      "new_writing_thread",
    );
    assert.ok(notification);
    assert.equal(notification.actorUsername, writer);
  }
  assert.equal(ofType(await notificationsOf(writerCookie), "new_writing_thread").length, 0);
});

test("a new page tells the group but not its author", async () => {
  const { adminCookie, writerCookie, readerCookie, group: created } = await group();

  const response = await request("POST", `/api/groups/${created.id}/pages`, writerCookie, {
    title: "Die Bergstadt",
    document: plainTextToDocument("Ein Hafen."),
  });
  assert.equal(response.status, STATUS_CODE.Created);
  const page = await response.json();

  for (const cookie of [adminCookie, readerCookie]) {
    const [notification] = ofType(
      // oxlint-disable-next-line no-await-in-loop -- sequential on purpose, one case per iteration
      await notificationsOf(cookie),
      "new_writing_page",
    );
    assert.ok(notification);
    assert.equal(notification.actorUsername, writer);
    // The page's own subject, which is what the interface links to.
    assert.equal(notification.writingPageId, page.id);
    assert.equal(notification.writingPageTitle, "Die Bergstadt");
  }
  assert.equal(ofType(await notificationsOf(writerCookie), "new_writing_page").length, 0);
});

test("a published post tells the group but not its author", async () => {
  const { adminCookie, writerCookie, group: created } = await group();
  const thread = await (
    await request("POST", `/api/groups/${created.id}/threads`, adminCookie, { title: "Kapitel 1" })
  ).json();

  await request(
    "POST",
    `/api/groups/${created.id}/threads/${thread.id}/posts`,
    writerCookie,
    postBody("Die Laternen gingen aus."),
  );

  assert.equal(ofType(await notificationsOf(adminCookie), "new_writing_post").length, 1);
  assert.equal(ofType(await notificationsOf(writerCookie), "new_writing_post").length, 0);
});

test("a draft tells nobody until it is published", async () => {
  const { adminCookie, writerCookie, group: created } = await group();
  const thread = await (
    await request("POST", `/api/groups/${created.id}/threads`, adminCookie, { title: "Kapitel 1" })
  ).json();
  const posts = `/api/groups/${created.id}/threads/${thread.id}/posts`;

  const draft = await (
    await request("POST", posts, writerCookie, postBody("Noch nicht fertig.", { isDraft: true }))
  ).json();

  // Nobody can see it, so nobody is told about it.
  assert.equal(ofType(await notificationsOf(adminCookie), "new_writing_post").length, 0);

  await request("PATCH", `${posts}/${draft.id}`, writerCookie, {
    isDraft: false,
  });

  assert.equal(ofType(await notificationsOf(adminCookie), "new_writing_post").length, 1);
});

test("editing a published post does not announce it again", async () => {
  const { adminCookie, writerCookie, group: created } = await group();
  const thread = await (
    await request("POST", `/api/groups/${created.id}/threads`, adminCookie, { title: "Kapitel 1" })
  ).json();
  const posts = `/api/groups/${created.id}/threads/${thread.id}/posts`;
  const post = await (
    await request("POST", posts, writerCookie, postBody("Die Laternen gingen aus."))
  ).json();

  await request("PATCH", `${posts}/${post.id}`, writerCookie, postBody("Doch anders."));

  assert.equal(ofType(await notificationsOf(adminCookie), "new_writing_post").length, 1);
});

test("a role change tells the member, and twice leaves one notification", async () => {
  const { adminCookie, writerCookie, group: created } = await group();
  const writerId = await getUserId(writer);
  const membership = `/api/groups/${created.id}/memberships/${writerId}`;

  await request("PATCH", membership, adminCookie, { role: "reader" });
  await request("PATCH", membership, adminCookie, { role: "writer" });

  const changes = ofType(await notificationsOf(writerCookie), "role_changed_in_writing_group");
  assert.equal(changes.length, 1, "a role is a state, not a series of occurrences");
  const [change] = changes;
  assert.ok(change);
  assert.equal(change.actorUsername, administrator);
});

test("an administrator changing their own role is not told about it", async () => {
  const { adminCookie, group: created } = await group();
  const administratorId = await getUserId(administrator);

  // The constraint forbids notifying the actor, so an unguarded producer would fail this
  // request outright rather than merely say something odd.
  const response = await request(
    "PATCH",
    `/api/groups/${created.id}/memberships/${administratorId}`,
    adminCookie,
    { role: "reader" },
  );

  assert.equal(response.status, STATUS_CODE.OK);
  assert.equal(
    ofType(await notificationsOf(adminCookie), "role_changed_in_writing_group").length,
    0,
  );
});

test("an invited member is not told what the group is writing", async () => {
  const { adminCookie, group: created } = await group();
  // Invited, never accepted.
  const pendingCookie = await registerUser("producers-pending");
  const pendingId = await getUserId("producers-pending");
  await request("POST", `/api/groups/${created.id}/memberships`, adminCookie, {
    userId: pendingId,
    role: "writer",
  });

  await request("POST", `/api/groups/${created.id}/threads`, adminCookie, {
    title: "Kapitel 1",
  });

  const notifications = await notificationsOf(pendingCookie);
  assert.equal(ofType(notifications, "new_writing_thread").length, 0);
  // Their invitation is still there; only the activity is not.
  assert.equal(ofType(notifications, "invited_to_writing_group").length, 1);

  await deleteUsers(["producers-pending"]);
});

test("turning a group public tells its members, not the administrator", async () => {
  const { adminCookie, writerCookie, group: created } = await group();

  const response = await request("PATCH", `/api/groups/${created.id}`, adminCookie, {
    visibility: "public",
  });
  assert.equal(response.status, STATUS_CODE.OK);

  const [notification] = ofType(
    await notificationsOf(writerCookie),
    "visibility_changed_in_writing_group",
  );
  assert.ok(notification);
  assert.equal(notification.actorUsername, administrator);
  assert.equal(
    ofType(await notificationsOf(adminCookie), "visibility_changed_in_writing_group").length,
    0,
  );
});

test("a visibility that does not move tells nobody", async () => {
  const { adminCookie, writerCookie, group: created } = await group();

  // The group is already private, and a form may well send the value it started with.
  await request("PATCH", `/api/groups/${created.id}`, adminCookie, {
    visibility: "private",
  });
  // Renaming is not a change to who can see the writing.
  await request("PATCH", `/api/groups/${created.id}`, adminCookie, {
    title: "Anders",
  });

  assert.equal(
    ofType(await notificationsOf(writerCookie), "visibility_changed_in_writing_group").length,
    0,
  );
});

test("flipping visibility twice leaves one notification", async () => {
  const { adminCookie, writerCookie, group: created } = await group();

  await request("PATCH", `/api/groups/${created.id}`, adminCookie, {
    visibility: "public",
  });
  await request("PATCH", `/api/groups/${created.id}`, adminCookie, {
    visibility: "private",
  });

  const changes = ofType(
    await notificationsOf(writerCookie),
    "visibility_changed_in_writing_group",
  );
  assert.equal(changes.length, 1, "what matters is what the group is now");
});

test("accepting an invitation tells whoever sent it", async () => {
  const adminCookie = await registerUser(administrator);
  const created = await createGroup(adminCookie, "Der Erinnerungsmarkt");
  const invitedCookie = await registerUser(writer);
  const invitedId = await getUserId(writer);

  await request("POST", `/api/groups/${created.id}/memberships`, adminCookie, {
    userId: invitedId,
    role: "writer",
  });
  await request("POST", `/api/groups/${created.id}/memberships/me/accept`, invitedCookie);

  const [notification] = ofType(await notificationsOf(adminCookie), "invitation_accepted");
  assert.ok(notification);
  assert.equal(notification.actorUsername, writer);
  // The person accepting is not told about their own doing.
  assert.equal(ofType(await notificationsOf(invitedCookie), "invitation_accepted").length, 0);
});

test("the member list says who did the inviting, while it is still an invitation", async () => {
  const adminCookie = await registerUser(administrator);
  const created = await createGroup(adminCookie, "Der Erinnerungsmarkt");
  await registerUser(writer);
  const invitedId = await getUserId(writer);

  await request("POST", `/api/groups/${created.id}/memberships`, adminCookie, {
    userId: invitedId,
    role: "writer",
  });

  const page = await (
    await request("GET", `/api/groups/${created.id}/memberships`, adminCookie)
  ).json();

  const invited = page.results.find((m: { username: string }) => m.username === writer);
  assert.equal(invited.invitedByUsername, administrator);

  // The founder was invited by nobody.
  const founder = page.results.find((m: { username: string }) => m.username === administrator);
  assert.equal(founder.invitedByUsername, null);
});
