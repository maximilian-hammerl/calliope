import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import {
  clearRateLimits,
  deleteUsers,
  postBody,
  registerUser,
  request,
} from "@/src/test/support.ts";
import { clearForum, closeForumThread, createForumFolder } from "@/src/test/forum.ts";
import { makeOperator } from "@/src/test/reports.ts";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import { PAGE_CHANGED } from "@/src/http/response.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";

const member = "forum-write-member";
const operator = "forum-write-operator";

beforeEach(clearRateLimits);
afterEach(async () => {
  await clearForum([member, operator]);
  await deleteUsers([member, operator]);
});

const startThread = (cookie: string, title: string, folderId?: string) =>
  request("POST", "/api/forum/threads", cookie, {
    title,
    ...(folderId === undefined ? {} : { folderId }),
  });

const reply = (cookie: string, threadId: string, text: string) =>
  request("POST", `/api/forum/threads/${threadId}/posts`, cookie, postBody(text));

const addPage = (cookie: string, title: string, text: string, folderId?: string) =>
  request("POST", "/api/forum/pages", cookie, {
    title,
    document: plainTextToDocument(text),
    ...(folderId === undefined ? {} : { folderId }),
  });

test("POST /api/forum/threads: the root is an operator's, a `write` folder is anybody's", async () => {
  const memberCookie = await registerUser(member);
  const operatorCookie = await makeOperator(operator, await registerUser(operator));

  // Nothing above a root thread answers for it, so the forum's constant does — and it is `read`.
  assert.equal((await startThread(memberCookie, "Am Wurzelknoten")).status, STATUS_CODE.Forbidden);
  assert.equal((await startThread(operatorCookie, "Am Wurzelknoten")).status, STATUS_CODE.Created);

  const open = await createForumFolder("Forenspiele", "write");
  const created = await startThread(memberCookie, "Wortkette", open.id);
  assert.equal(created.status, STATUS_CODE.Created);
  const thread = await created.json();
  assert.equal(thread.title, "Wortkette");
  assert.equal(thread.folderId, open.id);
  // What a new thread adds of its own is nothing, so the folder's answer stands.
  assert.equal(thread.effectiveMemberPermission, "write");
});

test("POST /api/forum/threads: a read-only folder refuses, a hidden one does not exist", async () => {
  const memberCookie = await registerUser(member);

  const readable = await createForumFolder("Ankündigungen", "read");
  const hidden = await createForumFolder("Werkstatt", "hidden");

  assert.equal(
    (await startThread(memberCookie, "Nicht hier", readable.id)).status,
    STATUS_CODE.Forbidden,
  );
  // 404 rather than 403: a member must not learn that the folder is there.
  assert.equal(
    (await startThread(memberCookie, "Nicht hier", hidden.id)).status,
    STATUS_CODE.NotFound,
  );
});

test("POST /api/forum/threads/{threadId}/posts: a post follows the thread's permission", async () => {
  const memberCookie = await registerUser(member);
  const operatorCookie = await makeOperator(operator, await registerUser(operator));

  const open = await createForumFolder("Forenspiele", "write");
  const closed = await createForumFolder("Beendete Spiele", "read");

  const openThread = await (await startThread(memberCookie, "Offen", open.id)).json();
  const closedThread = await (await startThread(operatorCookie, "Geschlossen", closed.id)).json();

  const written = await reply(memberCookie, openThread.id, "Abendrot");
  assert.equal(written.status, STATUS_CODE.Created);
  const post = await written.json();
  assert.equal(post.text, "Abendrot");
  assert.equal(post.isDraft, false);
  assert.equal(post.createdByUsername, member);

  // A page's „locked": the thread is readable and takes no posts.
  assert.equal(
    (await reply(memberCookie, closedThread.id, "Doch nicht")).status,
    STATUS_CODE.Forbidden,
  );
  // An operator is not held to it.
  assert.equal(
    (await reply(operatorCookie, closedThread.id, "Nachtrag")).status,
    STATUS_CODE.Created,
  );
});

test("POST /api/forum/threads/{threadId}/posts: a hidden thread does not exist to a member", async () => {
  const memberCookie = await registerUser(member);
  const operatorCookie = await makeOperator(operator, await registerUser(operator));

  const hidden = await createForumFolder("Werkstatt", "hidden");
  const thread = await (await startThread(operatorCookie, "Entwurf", hidden.id)).json();

  assert.equal(
    (await reply(memberCookie, thread.id, "Sollte nicht gehen")).status,
    STATUS_CODE.NotFound,
  );
});

test("POST /api/forum/pages: a page follows the folder, and carries its prose back", async () => {
  const memberCookie = await registerUser(member);

  const open = await createForumFolder("Bücherclub", "write");
  const readable = await createForumFolder("Ankündigungen", "read");

  const created = await addPage(
    memberCookie,
    "Buch des Monats",
    "Im September lesen wir etwas Langes.",
    open.id,
  );
  assert.equal(created.status, STATUS_CODE.Created);
  const page = await created.json();
  assert.equal(page.title, "Buch des Monats");
  assert.equal(page.document.type, "doc");
  // `text` is the server's projection for search and never leaves the server.
  assert.equal(page.text, undefined);

  assert.equal(
    (await addPage(memberCookie, "Nicht hier", "Nein.", readable.id)).status,
    STATUS_CODE.Forbidden,
  );
});

test("PUT /api/forum/pages/{pageId}: whoever may write there may rewrite it", async () => {
  const memberCookie = await registerUser(member);
  const operatorCookie = await makeOperator(operator, await registerUser(operator));

  const open = await createForumFolder("Bücherclub", "write");
  const page = await (await addPage(memberCookie, "Regeln", "Sei freundlich.", open.id)).json();

  // Somebody who did not write it: a page is written together rather than owned.
  const rewritten = await request("PUT", `/api/forum/pages/${page.id}`, operatorCookie, {
    title: "Regeln",
    document: plainTextToDocument("Sei freundlich und lies erst."),
    loadedAt: page.lastActivityAt,
  });
  assert.equal(rewritten.status, STATUS_CODE.OK);
  const saved = await rewritten.json();
  assert.equal(saved.updatedByUsername, operator);

  // The second save carries a `loadedAt` that is now behind, and is refused by name.
  const stale = await request("PUT", `/api/forum/pages/${page.id}`, memberCookie, {
    title: "Regeln",
    document: plainTextToDocument("Gleichzeitig geschrieben."),
    loadedAt: page.lastActivityAt,
  });
  assert.equal(stale.status, STATUS_CODE.Conflict);
  const refusal = await stale.json();
  assert.equal(refusal.code, PAGE_CHANGED);
  assert.equal(refusal.updatedByUsername, operator);
});

test("PUT /api/forum/pages/{pageId}: a read-only page refuses, a hidden one does not exist", async () => {
  const memberCookie = await registerUser(member);
  const operatorCookie = await makeOperator(operator, await registerUser(operator));

  const readable = await createForumFolder("Ankündigungen", "read");
  const hidden = await createForumFolder("Werkstatt", "hidden");

  const announcement = await (
    await addPage(operatorCookie, "Regeln", "Sei freundlich.", readable.id)
  ).json();
  const draft = await (
    await addPage(operatorCookie, "Entwurf", "Noch nicht fertig.", hidden.id)
  ).json();

  const body = (loadedAt: string) => ({
    title: "Geändert",
    document: plainTextToDocument("Nein."),
    loadedAt,
  });

  assert.equal(
    (
      await request(
        "PUT",
        `/api/forum/pages/${announcement.id}`,
        memberCookie,
        body(announcement.lastActivityAt),
      )
    ).status,
    STATUS_CODE.Forbidden,
  );
  assert.equal(
    (await request("PUT", `/api/forum/pages/${draft.id}`, memberCookie, body(draft.lastActivityAt)))
      .status,
    STATUS_CODE.NotFound,
  );
});

test("a draft post belongs to its author until it is published", async () => {
  const memberCookie = await registerUser(member);
  const operatorCookie = await makeOperator(operator, await registerUser(operator));

  const open = await createForumFolder("Forenspiele", "write");
  const thread = await (await startThread(memberCookie, "Wortkette", open.id)).json();

  const draft = await request(
    "POST",
    `/api/forum/threads/${thread.id}/posts`,
    memberCookie,
    postBody("Noch nicht fertig", { isDraft: true }),
  );
  assert.equal(draft.status, STATUS_CODE.Created);

  const listed = async (cookie: string, isDraft: boolean) => {
    const response = await request("QUERY", `/api/forum/threads/${thread.id}/posts`, cookie, {
      limit: 20,
      offset: 0,
      isDraft,
    });
    assert.equal(response.status, STATUS_CODE.OK);
    return (await response.json()).results as Array<{ text: string }>;
  };

  assert.deepEqual(await listed(memberCookie, false), []);
  assert.deepEqual(
    (await listed(memberCookie, true)).map((p) => p.text),
    ["Noch nicht fertig"],
  );
  // Another member's draft is nobody else's, an operator included.
  assert.deepEqual(await listed(operatorCookie, true), []);

  assert.ok(thread.id);
});

test("PATCH and DELETE a post: its author, and only while they may write there", async () => {
  const memberCookie = await registerUser(member);
  const operatorCookie = await makeOperator(operator, await registerUser(operator));

  const open = await createForumFolder("Forenspiele", "write");
  const thread = await (await startThread(memberCookie, "Wortkette", open.id)).json();
  const mine = await (await reply(memberCookie, thread.id, "Abendrot")).json();
  const theirs = await (await reply(operatorCookie, thread.id, "Rotkohl")).json();

  const edit = (cookie: string, postId: string, text: string) =>
    request("PATCH", `/api/forum/threads/${thread.id}/posts/${postId}`, cookie, {
      document: plainTextToDocument(text),
    });

  const changed = await edit(memberCookie, mine.id, "Abendröte");
  assert.equal(changed.status, STATUS_CODE.OK);
  const post = await changed.json();
  assert.equal(post.text, "Abendröte");
  // Editing a published post is the one change a reader is told about.
  assert.ok(post.editedAt);
  assert.equal(post.editedByUsername, member);

  // Somebody else's post is not theirs to change, and an operator's is not an exception to
  // that — it is theirs because they wrote it.
  assert.equal((await edit(memberCookie, theirs.id, "Nicht meins")).status, STATUS_CODE.Forbidden);
  // An operator may change anybody's.
  assert.equal((await edit(operatorCookie, mine.id, "Von der Moderation")).status, STATUS_CODE.OK);

  assert.equal(
    (await request("DELETE", `/api/forum/threads/${thread.id}/posts/${theirs.id}`, memberCookie))
      .status,
    STATUS_CODE.Forbidden,
  );
  assert.equal(
    (await request("DELETE", `/api/forum/threads/${thread.id}/posts/${mine.id}`, memberCookie))
      .status,
    STATUS_CODE.OK,
  );
});

test("closing a thread freezes the posts already written in it", async () => {
  const memberCookie = await registerUser(member);

  const open = await createForumFolder("Forenspiele", "write");
  const thread = await (await startThread(memberCookie, "Wortkette", open.id)).json();
  const mine = await (await reply(memberCookie, thread.id, "Abendrot")).json();

  // Closing it after the fact is the containment the author rule exists for: whoever wrote a
  // post keeps it only while they may still write there.
  await closeForumThread(thread.id);

  assert.equal(
    (
      await request("PATCH", `/api/forum/threads/${thread.id}/posts/${mine.id}`, memberCookie, {
        document: plainTextToDocument("Doch anders"),
      })
    ).status,
    STATUS_CODE.Forbidden,
  );
  assert.equal(
    (await request("DELETE", `/api/forum/threads/${thread.id}/posts/${mine.id}`, memberCookie))
      .status,
    STATUS_CODE.Forbidden,
  );

  // Reading it is untouched — the thread is closed, not hidden.
  const listed = await request("QUERY", `/api/forum/threads/${thread.id}/posts`, memberCookie, {
    limit: 20,
    offset: 0,
  });
  assert.equal(listed.status, STATUS_CODE.OK);
  assert.equal((await listed.json()).totalResults, 1);
});

/**
 * The bound is on the prose rather than on the serialisation, and it is declared in the document
 * for every one of these operations — so a route that skips it makes the specification a lie and
 * accepts what the same request to a writing group is refused.
 */
test("the prose bound holds on everything the forum writes", async () => {
  const memberCookie = await registerUser(member);
  const open = await createForumFolder("Bücherclub", "write");
  const tooLong = "a".repeat(TEXT_LIMIT.documentText + 1);

  assert.equal(
    (await addPage(memberCookie, "Zu lang", tooLong, open.id)).status,
    STATUS_CODE.BadRequest,
  );

  const page = await (await addPage(memberCookie, "Kurz", "Passt", open.id)).json();
  const rewritten = await request("PUT", `/api/forum/pages/${page.id}`, memberCookie, {
    title: "Zu lang",
    document: plainTextToDocument(tooLong),
    loadedAt: page.lastActivityAt,
  });
  assert.equal(rewritten.status, STATUS_CODE.BadRequest);

  const thread = await (await startThread(memberCookie, "Wortkette", open.id)).json();
  assert.equal((await reply(memberCookie, thread.id, tooLong)).status, STATUS_CODE.BadRequest);
  // A post may not be empty either, where a page named and left blank is a stub.
  assert.equal((await reply(memberCookie, thread.id, "")).status, STATUS_CODE.BadRequest);
});
