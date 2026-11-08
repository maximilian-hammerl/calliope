import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  postBody,
  registerUser,
  request,
} from "@/src/test/support.ts";
import {
  clearForum,
  createForumFolder,
  createForumPage,
  createForumThread,
} from "@/src/test/forum.ts";
import { makeOperator } from "@/src/test/reports.ts";

const member = "forum-permissions-member";
const operator = "forum-permissions-operator";

beforeEach(clearRateLimits);
afterEach(async () => {
  await clearForum([member, operator]);
  await deleteUsers([member, operator]);
});

async function operatorAndMember(): Promise<[string, string]> {
  const memberCookie = await registerUser(member);
  const operatorCookie = await makeOperator(
    operator,
    await registerUser(operator),
  );
  return [operatorCookie, memberCookie];
}

const setPermission = (
  cookie: string,
  targetType: string,
  targetId: string,
  memberPermission: string,
) =>
  request(
    "PUT",
    `/api/forum/permissions/${targetType}/${targetId}`,
    cookie,
    { memberPermission },
  );

/**
 * Titles a test asserts on carry the scope, because there is only one forum and the seed's rows
 * are in every list — a bare "Wortkette" matched the seeded one and the hiding looked broken.
 */
const scoped = (title: string) => `${title} (${operator})`;

const threadsVisibleTo = async (cookie: string): Promise<Array<string>> => {
  const response = await request("GET", "/api/forum/threads", cookie);
  return (await response.json()).results.map((
    thread: { title: string },
  ) => thread.title);
};

test("PUT /api/forum/permissions: one route for all three kinds, an operator's alone", async () => {
  const [operatorCookie, memberCookie] = await operatorAndMember();
  const folder = await createForumFolder("Forenspiele", "write");
  const thread = await createForumThread("Wortkette", "write", folder.id);
  const page = await createForumPage(
    "Regeln",
    "Sei freundlich.",
    "write",
    folder.id,
  );

  for (
    const [kind, id] of [
      ["folder", folder.id],
      ["thread", thread.id],
      ["page", page.id],
    ] as const
  ) {
    assert.equal(
      // deno-lint-ignore no-await-in-loop -- three requests, one after another
      (await setPermission(memberCookie, kind, id, "hidden")).status,
      STATUS_CODE.Forbidden,
    );
    assert.equal(
      // deno-lint-ignore no-await-in-loop -- as above
      (await setPermission(operatorCookie, kind, id, "read")).status,
      STATUS_CODE.OK,
    );
  }
});

test("hiding a folder hides everything in it, and re-opening it gives them back", async () => {
  const [operatorCookie, memberCookie] = await operatorAndMember();
  const folder = await createForumFolder("Forenspiele", "write");
  const title = scoped("Wortkette");
  await createForumThread(title, "write", folder.id);

  assert.equal((await threadsVisibleTo(memberCookie)).includes(title), true);

  assert.equal(
    (await setPermission(operatorCookie, "folder", folder.id, "hidden")).status,
    STATUS_CODE.OK,
  );
  assert.equal((await threadsVisibleTo(memberCookie)).includes(title), false);
  // The operator still sees it, which is what the mark in the tree is for.
  assert.equal((await threadsVisibleTo(operatorCookie)).includes(title), true);

  assert.equal(
    (await setPermission(operatorCookie, "folder", folder.id, "write")).status,
    STATUS_CODE.OK,
  );
  assert.equal((await threadsVisibleTo(memberCookie)).includes(title), true);
});

test("closing a thread stops a member writing in it without hiding it", async () => {
  const [operatorCookie, memberCookie] = await operatorAndMember();
  const folder = await createForumFolder("Bücherclub", "write");
  const title = scoped("Buch des Monats");
  const thread = await createForumThread(title, "write", folder.id);

  const before = await request(
    "POST",
    `/api/forum/threads/${thread.id}/posts`,
    memberCookie,
    postBody("Ich lese mit."),
  );
  assert.equal(before.status, STATUS_CODE.Created);

  await setPermission(operatorCookie, "thread", thread.id, "read");

  const after = await request(
    "POST",
    `/api/forum/threads/${thread.id}/posts`,
    memberCookie,
    postBody("Doch nicht."),
  );
  assert.equal(after.status, STATUS_CODE.Forbidden);
  // Still readable: closing is not hiding.
  assert.equal((await threadsVisibleTo(memberCookie)).includes(title), true);
});

test("a permission is the row's own, so a folder above it still decides", async () => {
  const [operatorCookie, memberCookie] = await operatorAndMember();
  const closed = await createForumFolder("Beendete Spiele", "read");
  const thread = await createForumThread(
    "Sommerwettbewerb",
    "write",
    closed.id,
  );

  // Setting the thread to `write` cannot open what its folder closed.
  assert.equal(
    (await setPermission(operatorCookie, "thread", thread.id, "write")).status,
    STATUS_CODE.OK,
  );

  const posted = await request(
    "POST",
    `/api/forum/threads/${thread.id}/posts`,
    memberCookie,
    postBody("Noch etwas?"),
  );
  assert.equal(posted.status, STATUS_CODE.Forbidden);
});

test("PUT /api/forum/threads/{threadId}/folder: the destination is asked as well as the thread", async () => {
  const [operatorCookie, memberCookie] = await operatorAndMember();
  const open = await createForumFolder("Forenspiele", "write");
  const readable = await createForumFolder("Ankündigungen", "read");

  const started = await request("POST", "/api/forum/threads", memberCookie, {
    title: "Wortkette",
    folderId: open.id,
  });
  const thread = await started.json();

  // Their own thread, and a folder that only reads: refused on the destination, not on the thread.
  const intoReadable = await request(
    "PUT",
    `/api/forum/threads/${thread.id}/folder`,
    memberCookie,
    { folderId: readable.id },
  );
  assert.equal(intoReadable.status, STATUS_CODE.Forbidden);

  // An operator may, since they may put things anywhere.
  const byOperator = await request(
    "PUT",
    `/api/forum/threads/${thread.id}/folder`,
    operatorCookie,
    { folderId: readable.id },
  );
  assert.equal(byOperator.status, STATUS_CODE.OK);
  assert.equal((await byOperator.json()).effectiveMemberPermission, "read");
});

test("somebody else's thread is not theirs to move", async () => {
  const [operatorCookie, memberCookie] = await operatorAndMember();
  const open = await createForumFolder("Forenspiele", "write");
  const second = await createForumFolder("Bücherclub", "write");
  const thread = await createForumThread("Nicht deins", "write", open.id);

  assert.equal(
    (await request(
      "PUT",
      `/api/forum/threads/${thread.id}/folder`,
      memberCookie,
      { folderId: second.id },
    )).status,
    STATUS_CODE.Forbidden,
  );
  assert.equal(
    (await request(
      "PUT",
      `/api/forum/threads/${thread.id}/folder`,
      operatorCookie,
      { folderId: second.id },
    )).status,
    STATUS_CODE.OK,
  );
});

test("PUT /api/forum/pages/{pageId}/folder: whoever may write the page may move it", async () => {
  const [operatorCookie, memberCookie] = await operatorAndMember();
  const open = await createForumFolder("Bücherclub", "write");
  const second = await createForumFolder("Forenspiele", "write");
  const readable = await createForumFolder("Ankündigungen", "read");
  const page = await createForumPage(
    "Leseliste",
    "Was wir lesen.",
    "write",
    open.id,
  );

  // A page is written together, so this asks the page rather than who wrote it.
  assert.equal(
    (await request(
      "PUT",
      `/api/forum/pages/${page.id}/folder`,
      memberCookie,
      { folderId: second.id },
    )).status,
    STATUS_CODE.OK,
  );

  assert.equal(
    (await request(
      "PUT",
      `/api/forum/pages/${page.id}/folder`,
      memberCookie,
      { folderId: readable.id },
    )).status,
    STATUS_CODE.Forbidden,
  );

  // The root is an operator's, as creating there is.
  assert.equal(
    (await request(
      "PUT",
      `/api/forum/pages/${page.id}/folder`,
      memberCookie,
      { folderId: null },
    )).status,
    STATUS_CODE.Forbidden,
  );
  assert.equal(
    (await request(
      "PUT",
      `/api/forum/pages/${page.id}/folder`,
      operatorCookie,
      { folderId: null },
    )).status,
    STATUS_CODE.OK,
  );
});

test("a hidden thread cannot be moved by a member who cannot see it", async () => {
  const [operatorCookie, memberCookie] = await operatorAndMember();
  const hidden = await createForumFolder("Werkstatt", "hidden");
  const open = await createForumFolder("Forenspiele", "write");
  const thread = await createForumThread("Entwurf", "write", hidden.id);

  // 404 rather than 403: it does not exist to them.
  assert.equal(
    (await request(
      "PUT",
      `/api/forum/threads/${thread.id}/folder`,
      memberCookie,
      { folderId: open.id },
    )).status,
    STATUS_CODE.NotFound,
  );
  assert.equal(
    (await request(
      "PUT",
      `/api/forum/threads/${thread.id}/folder`,
      operatorCookie,
      { folderId: open.id },
    )).status,
    STATUS_CODE.OK,
  );
});

test("a writing group's folder is not the forum's to set", async () => {
  const [operatorCookie] = await operatorAndMember();
  const group = await createGroup(operatorCookie, "Der Zauberzwerg");
  const groupFolder = await (await request(
    "POST",
    `/api/groups/${group.id}/folders`,
    operatorCookie,
    { title: "Weltenbau" },
  )).json();
  assert.equal(typeof groupFolder.id, "string");

  // The route is an operator's, and this operator founded the group — so what refuses is the
  // scope, not the act: a group's folders are the group's own to govern.
  assert.equal(
    (await setPermission(operatorCookie, "folder", groupFolder.id, "hidden"))
      .status,
    STATUS_CODE.NotFound,
  );
});
