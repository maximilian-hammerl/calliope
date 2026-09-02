import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  postBody,
  registerUser,
  request,
} from "@/src/test/support.ts";

const administrator = "producers-admin";
const writer = "producers-writer";
const reader = "producers-reader";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, writer, reader]));

/** A group with an administrator and two members who have accepted. */
async function group() {
  const adminCookie = await registerUser(administrator);
  const created = await createGroup(adminCookie, "Der Erinnerungsmarkt");
  const writerCookie = await addMember(
    adminCookie,
    created.id,
    writer,
    "writer",
  );
  const readerCookie = await addMember(
    adminCookie,
    created.id,
    reader,
    "reader",
  );
  return { adminCookie, writerCookie, readerCookie, group: created };
}

async function notificationsOf(cookie: string) {
  const response = await request("QUERY", "/api/notifications", cookie, {
    limit: 50,
  });
  assertEquals(response.status, STATUS_CODE.OK);
  return (await response.json()).results as Array<
    { type: string; actorUsername: string }
  >;
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

Deno.test("a new thread tells the group but not its author", async () => {
  const { adminCookie, writerCookie, readerCookie, group: created } =
    await group();

  const response = await request(
    "POST",
    `/api/groups/${created.id}/threads`,
    writerCookie,
    { title: "Kapitel 1" },
  );
  assertEquals(response.status, STATUS_CODE.Created);

  for (const cookie of [adminCookie, readerCookie]) {
    const [notification] = ofType(
      // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
      await notificationsOf(cookie),
      "new_writing_thread",
    );
    assertExists(notification);
    assertEquals(notification.actorUsername, writer);
  }
  assertEquals(
    ofType(await notificationsOf(writerCookie), "new_writing_thread").length,
    0,
  );
});

Deno.test("a new page tells the group but not its author", async () => {
  const { adminCookie, writerCookie, readerCookie, group: created } =
    await group();

  const response = await request(
    "POST",
    `/api/groups/${created.id}/pages`,
    writerCookie,
    { title: "Die Bergstadt", document: plainTextToDocument("Ein Hafen.") },
  );
  assertEquals(response.status, STATUS_CODE.Created);
  const page = await response.json();

  for (const cookie of [adminCookie, readerCookie]) {
    const [notification] = ofType(
      // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
      await notificationsOf(cookie),
      "new_writing_page",
    );
    assertExists(notification);
    assertEquals(notification.actorUsername, writer);
    // The page's own subject, which is what the interface links to.
    assertEquals(notification.writingPageId, page.id);
    assertEquals(notification.writingPageTitle, "Die Bergstadt");
  }
  assertEquals(
    ofType(await notificationsOf(writerCookie), "new_writing_page").length,
    0,
  );
});

Deno.test("a published post tells the group but not its author", async () => {
  const { adminCookie, writerCookie, group: created } = await group();
  const thread = await (await request(
    "POST",
    `/api/groups/${created.id}/threads`,
    adminCookie,
    { title: "Kapitel 1" },
  )).json();

  await request(
    "POST",
    `/api/groups/${created.id}/threads/${thread.id}/posts`,
    writerCookie,
    postBody("Die Laternen gingen aus."),
  );

  assertEquals(
    ofType(await notificationsOf(adminCookie), "new_writing_post").length,
    1,
  );
  assertEquals(
    ofType(await notificationsOf(writerCookie), "new_writing_post").length,
    0,
  );
});

Deno.test("a draft tells nobody until it is published", async () => {
  const { adminCookie, writerCookie, group: created } = await group();
  const thread = await (await request(
    "POST",
    `/api/groups/${created.id}/threads`,
    adminCookie,
    { title: "Kapitel 1" },
  )).json();
  const posts = `/api/groups/${created.id}/threads/${thread.id}/posts`;

  const draft = await (await request(
    "POST",
    posts,
    writerCookie,
    postBody("Noch nicht fertig.", { isDraft: true }),
  )).json();

  // Nobody can see it, so nobody is told about it.
  assertEquals(
    ofType(await notificationsOf(adminCookie), "new_writing_post").length,
    0,
  );

  await request("PATCH", `${posts}/${draft.id}`, writerCookie, {
    isDraft: false,
  });

  assertEquals(
    ofType(await notificationsOf(adminCookie), "new_writing_post").length,
    1,
  );
});

Deno.test("editing a published post does not announce it again", async () => {
  const { adminCookie, writerCookie, group: created } = await group();
  const thread = await (await request(
    "POST",
    `/api/groups/${created.id}/threads`,
    adminCookie,
    { title: "Kapitel 1" },
  )).json();
  const posts = `/api/groups/${created.id}/threads/${thread.id}/posts`;
  const post = await (await request(
    "POST",
    posts,
    writerCookie,
    postBody("Die Laternen gingen aus."),
  )).json();

  await request(
    "PATCH",
    `${posts}/${post.id}`,
    writerCookie,
    postBody("Doch anders."),
  );

  assertEquals(
    ofType(await notificationsOf(adminCookie), "new_writing_post").length,
    1,
  );
});

Deno.test("a role change tells the member, and twice leaves one notification", async () => {
  const { adminCookie, writerCookie, group: created } = await group();
  const writerId = await getUserId(writer);
  const membership = `/api/groups/${created.id}/memberships/${writerId}`;

  await request("PATCH", membership, adminCookie, { role: "reader" });
  await request("PATCH", membership, adminCookie, { role: "writer" });

  const changes = ofType(
    await notificationsOf(writerCookie),
    "role_changed_in_writing_group",
  );
  assertEquals(
    changes.length,
    1,
    "a role is a state, not a series of occurrences",
  );
  const [change] = changes;
  assertExists(change);
  assertEquals(change.actorUsername, administrator);
});

Deno.test("an administrator changing their own role is not told about it", async () => {
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

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(
    ofType(await notificationsOf(adminCookie), "role_changed_in_writing_group")
      .length,
    0,
  );
});

Deno.test("an invited member is not told what the group is writing", async () => {
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
  assertEquals(ofType(notifications, "new_writing_thread").length, 0);
  // Their invitation is still there; only the activity is not.
  assertEquals(ofType(notifications, "invited_to_writing_group").length, 1);

  await deleteUsers(["producers-pending"]);
});

Deno.test("turning a group public tells its members, not the administrator", async () => {
  const { adminCookie, writerCookie, group: created } = await group();

  const response = await request(
    "PATCH",
    `/api/groups/${created.id}`,
    adminCookie,
    {
      visibility: "public",
    },
  );
  assertEquals(response.status, STATUS_CODE.OK);

  const [notification] = ofType(
    await notificationsOf(writerCookie),
    "visibility_changed_in_writing_group",
  );
  assertExists(notification);
  assertEquals(notification.actorUsername, administrator);
  assertEquals(
    ofType(
      await notificationsOf(adminCookie),
      "visibility_changed_in_writing_group",
    ).length,
    0,
  );
});

Deno.test("a visibility that does not move tells nobody", async () => {
  const { adminCookie, writerCookie, group: created } = await group();

  // The group is already private, and a form may well send the value it started with.
  await request("PATCH", `/api/groups/${created.id}`, adminCookie, {
    visibility: "private",
  });
  // Renaming is not a change to who can see the writing.
  await request("PATCH", `/api/groups/${created.id}`, adminCookie, {
    title: "Anders",
  });

  assertEquals(
    ofType(
      await notificationsOf(writerCookie),
      "visibility_changed_in_writing_group",
    ).length,
    0,
  );
});

Deno.test("flipping visibility twice leaves one notification", async () => {
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
  assertEquals(changes.length, 1, "what matters is what the group is now");
});

Deno.test("accepting an invitation tells whoever sent it", async () => {
  const adminCookie = await registerUser(administrator);
  const created = await createGroup(adminCookie, "Der Erinnerungsmarkt");
  const invitedCookie = await registerUser(writer);
  const invitedId = await getUserId(writer);

  await request("POST", `/api/groups/${created.id}/memberships`, adminCookie, {
    userId: invitedId,
    role: "writer",
  });
  await request(
    "POST",
    `/api/groups/${created.id}/memberships/me/accept`,
    invitedCookie,
  );

  const [notification] = ofType(
    await notificationsOf(adminCookie),
    "invitation_accepted",
  );
  assertExists(notification);
  assertEquals(notification.actorUsername, writer);
  // The person accepting is not told about their own doing.
  assertEquals(
    ofType(await notificationsOf(invitedCookie), "invitation_accepted").length,
    0,
  );
});

Deno.test("the member list says who did the inviting, while it is still an invitation", async () => {
  const adminCookie = await registerUser(administrator);
  const created = await createGroup(adminCookie, "Der Erinnerungsmarkt");
  await registerUser(writer);
  const invitedId = await getUserId(writer);

  await request("POST", `/api/groups/${created.id}/memberships`, adminCookie, {
    userId: invitedId,
    role: "writer",
  });

  const page = await (await request(
    "GET",
    `/api/groups/${created.id}/memberships`,
    adminCookie,
  )).json();

  const invited = page.results.find((m: { username: string }) =>
    m.username === writer
  );
  assertEquals(invited.invitedByUsername, administrator);

  // The founder was invited by nobody.
  const founder = page.results.find((m: { username: string }) =>
    m.username === administrator
  );
  assertEquals(founder.invitedByUsername, null);
});
