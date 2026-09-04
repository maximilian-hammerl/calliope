import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  createGroup,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";
import {
  clearForum,
  createForumFolder,
  createForumPage,
  createForumPost,
  createForumThread,
} from "@/src/test/forum.ts";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import { setFavourite } from "@/src/test/favourites.ts";
import {
  cleanUpReports,
  fileReport,
  makeOperator,
  ownRow,
} from "@/src/test/reports.ts";

const member = "forum-test-member";
const operator = "forum-test-operator";

/**
 * How the test finds its own row in the queue. Scoped to this file for the reason `reportFixture`
 * gives: the excerpt is the only handle on a report.
 */
const REPORTED_TEXT = "Sei freundlich (forum).";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(async () => {
  await clearForum([member, operator]);
  // `report`'s references are all ON DELETE SET NULL so a report outlives its target and its
  // reporter, which is exactly why deleting the accounts does not take these with it.
  await cleanUpReports([member, operator]);
});

type Row = {
  id: string;
  title: string;
  effectiveMemberPermission: string;
  isFavourite?: boolean;
};

async function listOf(
  cookie: string,
  what: "folders" | "threads" | "pages",
): Promise<Row[]> {
  const response = await request("GET", `/api/forum/${what}`, cookie);
  assertEquals(response.status, STATUS_CODE.OK);
  const { results } = await response.json();
  return results;
}

/**
 * Only the rows this test made: there is one forum, so the seed's are in every list and an
 * assertion over the whole of it would turn on whatever else is there.
 */
function titles(rows: Row[], made: ReadonlyArray<{ id: string }>): string[] {
  const ids = new Set(made.map((row) => row.id));
  return rows
    .filter((row) => ids.has(row.id))
    .map((row) => row.title)
    .sort();
}

Deno.test("GET /api/forum/folders hides a hidden folder from a member and shows it to an operator", async () => {
  const memberCookie = await registerUser(member);
  const operatorCookie = await makeOperator(
    operator,
    await registerUser(operator),
  );

  const mine = [
    await createForumFolder("Ankündigungen", "read"),
    await createForumFolder("Forenspiele", "write"),
    await createForumFolder("Werkstatt", "hidden"),
  ];

  assertEquals(titles(await listOf(memberCookie, "folders"), mine), [
    "Ankündigungen",
    "Forenspiele",
  ]);
  assertEquals(titles(await listOf(operatorCookie, "folders"), mine), [
    "Ankündigungen",
    "Forenspiele",
    "Werkstatt",
  ]);

  // And what an operator is *told* is what members get, not their own authority: it is the only
  // thing that can say „Werkstatt" is hidden from everyone else.
  const asOperator = new Map(
    (await listOf(operatorCookie, "folders")).map((
      row,
    ) => [row.title, row.effectiveMemberPermission]),
  );
  assertEquals(asOperator.get("Werkstatt"), "hidden");
  assertEquals(asOperator.get("Ankündigungen"), "read");
  assertEquals(asOperator.get("Forenspiele"), "write");
});

Deno.test("a folder under a hidden one is gone as well, however it is set itself", async () => {
  const memberCookie = await registerUser(member);

  const hidden = await createForumFolder("Werkstatt", "hidden");
  const nested = await createForumFolder("Entwürfe", "write", hidden.id);

  assertEquals(
    titles(await listOf(memberCookie, "folders"), [hidden, nested]),
    [],
  );
});

Deno.test("a top-level folder may grant `write`, which is what makes writing reachable", async () => {
  const memberCookie = await registerUser(member);

  const made = await createForumFolder("Forenspiele", "write");

  const folder = (await listOf(memberCookie, "folders")).find((row) =>
    row.id === made.id
  );
  assertEquals(folder?.effectiveMemberPermission, "write");
});

Deno.test("GET /api/forum/threads reports what a member may do, and the root is read-only", async () => {
  const memberCookie = await registerUser(member);

  const writable = await createForumFolder("Forenspiele", "write");
  const readable = await createForumFolder("Ankündigungen", "read");

  // Each of these asks for `write`, so what differs in the answers is only what is above them.
  await createForumThread("Am Wurzelknoten", "write");
  await createForumThread("Im Spielforum", "write", writable.id);
  await createForumThread("Bei den Ankündigungen", "write", readable.id);

  const byTitle = new Map(
    (await listOf(memberCookie, "threads")).map((
      row,
    ) => [row.title, row.effectiveMemberPermission]),
  );

  assertEquals(byTitle.get("Am Wurzelknoten"), "read");
  assertEquals(byTitle.get("Im Spielforum"), "write");
  assertEquals(byTitle.get("Bei den Ankündigungen"), "read");
});

Deno.test("a thread is hidden by its own setting or by its folder's", async () => {
  const memberCookie = await registerUser(member);

  const hiddenFolder = await createForumFolder("Werkstatt", "hidden");
  const openFolder = await createForumFolder("Forenspiele", "write");

  const mine = [
    await createForumThread("Sichtbar", "write", openFolder.id),
    await createForumThread("Eigen versteckt", "hidden", openFolder.id),
    await createForumThread("Ordner versteckt", "write", hiddenFolder.id),
  ];

  assertEquals(titles(await listOf(memberCookie, "threads"), mine), [
    "Sichtbar",
  ]);
});

Deno.test("GET /api/forum/threads/{threadId} answers 404 for a hidden thread rather than 403", async () => {
  const memberCookie = await registerUser(member);
  const operatorCookie = await makeOperator(
    operator,
    await registerUser(operator),
  );

  const thread = await createForumThread("Eigen versteckt", "hidden");

  const refused = await request(
    "GET",
    `/api/forum/threads/${thread.id}`,
    memberCookie,
  );
  assertEquals(refused.status, STATUS_CODE.NotFound);

  const allowed = await request(
    "GET",
    `/api/forum/threads/${thread.id}`,
    operatorCookie,
  );
  assertEquals(allowed.status, STATUS_CODE.OK);
});

Deno.test("QUERY /api/forum/threads/{threadId}/posts pages a thread's posts, and refuses a hidden one", async () => {
  const memberCookie = await registerUser(member);
  const memberId = await getUserId(member);

  const open = await createForumThread("Sichtbar", "read");
  const hidden = await createForumThread("Versteckt", "hidden");
  await createForumPost(open.id, "Der erste Beitrag", memberId);
  await createForumPost(hidden.id, "Nicht zu sehen", memberId);

  const response = await request(
    "QUERY",
    `/api/forum/threads/${open.id}/posts`,
    memberCookie,
    { limit: 20, offset: 0 },
  );
  assertEquals(response.status, STATUS_CODE.OK);
  const page = await response.json();
  assertEquals(page.totalResults, 1);
  assertEquals(page.results[0].text, "Der erste Beitrag");

  const refused = await request(
    "QUERY",
    `/api/forum/threads/${hidden.id}/posts`,
    memberCookie,
    { limit: 20, offset: 0 },
  );
  assertEquals(refused.status, STATUS_CODE.NotFound);
});

Deno.test("GET /api/forum/pages lists what a member may see, and one page carries its prose", async () => {
  const memberCookie = await registerUser(member);

  const readable = await createForumFolder("Ankündigungen", "read");
  const page = await createForumPage(
    "Regeln",
    "Sei freundlich.",
    "write",
    readable.id,
  );
  const draft = await createForumPage(
    "Entwurf",
    "Noch nicht fertig.",
    "hidden",
  );

  assertEquals(titles(await listOf(memberCookie, "pages"), [page, draft]), [
    "Regeln",
  ]);

  const response = await request(
    "GET",
    `/api/forum/pages/${page.id}`,
    memberCookie,
  );
  assertEquals(response.status, STATUS_CODE.OK);
  const body = await response.json();
  assertEquals(body.title, "Regeln");
  // The folder is `read`, so the page cannot widen it back to `write`.
  assertEquals(body.effectiveMemberPermission, "read");
  assertExists(body.document);
  // `text` is the server's projection for search, and never leaves the server.
  assertEquals(body.text, undefined);
});

Deno.test("the forum and a writing group cannot see each other's rows", async () => {
  const memberCookie = await registerUser(member);
  const group = await createGroup(memberCookie, "Der Zauberzwerg");

  await request("POST", `/api/groups/${group.id}/folders`, memberCookie, {
    title: "Weltenbau",
  });
  const groupFolder = await request(
    "POST",
    `/api/groups/${group.id}/folders`,
    memberCookie,
    { title: "Weltenbau" },
  );
  const groupThread = await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    memberCookie,
    { title: "Kapitel 1" },
  );
  const groupPage = await request(
    "POST",
    `/api/groups/${group.id}/pages`,
    memberCookie,
    { title: "Stadt A", document: plainTextToDocument("Ein Hafen im Norden.") },
  );
  const inGroup = [
    await groupFolder.json(),
    await groupThread.json(),
    await groupPage.json(),
  ];

  const forumFolder = await createForumFolder("Forenspiele", "write");
  const forumThread = await createForumThread(
    "Was schaust du gerade?",
    "write",
  );
  const forumPage = await createForumPage("Regeln", "Sei freundlich.", "read");
  const inForum = [forumFolder, forumThread, forumPage];

  // Neither list contains anything the other made — asserted over both sets, so a leak in
  // either direction fails rather than only a missing row.
  const both = [...inGroup, ...inForum];

  assertEquals(titles(await listOf(memberCookie, "folders"), both), [
    "Forenspiele",
  ]);
  assertEquals(titles(await listOf(memberCookie, "threads"), both), [
    "Was schaust du gerade?",
  ]);
  assertEquals(titles(await listOf(memberCookie, "pages"), both), ["Regeln"]);

  const groupFolders = await request(
    "GET",
    `/api/groups/${group.id}/folders`,
    memberCookie,
  );
  assertEquals(titles((await groupFolders.json()).results, both), [
    "Weltenbau",
  ]);

  const groupThreads = await request(
    "GET",
    `/api/groups/${group.id}/threads`,
    memberCookie,
  );
  assertEquals(titles((await groupThreads.json()).results, both), [
    "Kapitel 1",
  ]);

  // As an operator too, which is the case worth stating: they are not filtered by permission at
  // all, so `writing_group_id IS NULL` is the only thing keeping a group's writing out.
  const operatorCookie = await makeOperator(
    operator,
    await registerUser(operator),
  );
  assertEquals(titles(await listOf(operatorCookie, "folders"), both), [
    "Forenspiele",
  ]);
  assertEquals(titles(await listOf(operatorCookie, "threads"), both), [
    "Was schaust du gerade?",
  ]);
  assertEquals(titles(await listOf(operatorCookie, "pages"), both), [
    "Regeln",
  ]);
});

Deno.test("favouriting and reporting reach forum content, and refuse what is hidden", async () => {
  const memberCookie = await registerUser(member);

  const open = await createForumThread("Sichtbar", "read");
  const hidden = await createForumThread("Versteckt", "hidden");
  const page = await createForumPage("Regeln", REPORTED_TEXT, "read");

  assertEquals(
    (await setFavourite(memberCookie, "writing_thread", open.id)).status,
    STATUS_CODE.OK,
  );
  assertEquals(
    (await setFavourite(memberCookie, "writing_thread", hidden.id)).status,
    STATUS_CODE.NotFound,
  );

  const favourited = (await listOf(memberCookie, "threads")).find((row) =>
    row.id === open.id
  );
  assertEquals(favourited?.isFavourite, true);

  assertEquals(
    (await fileReport(memberCookie, "writing_page", page.id)).status,
    STATUS_CODE.OK,
  );
  assertEquals(
    (await fileReport(memberCookie, "writing_thread", hidden.id)).status,
    STATUS_CODE.NotFound,
  );

  // The prose, not the title: the page branch of `visible_target` excerpts what it said, which is
  // also how the moderation queue is searched here.
  const operatorCookie = await makeOperator(
    operator,
    await registerUser(operator),
  );
  assertExists(await ownRow(operatorCookie, REPORTED_TEXT));
});

/**
 * The reading direction is above; this is the writing one. A group's thread routes take an id from
 * the path, and the forum's threads now sit in the same table — so the service scopes every write
 * to the group, exactly as the page service does, rather than trusting each route to have asked
 * first. That is what makes the non-null `writingGroupId` on `Thread` true rather than asserted.
 */
Deno.test("a group's thread routes cannot reach a thread of the forum", async () => {
  const memberCookie = await registerUser(member);
  const group = await createGroup(memberCookie, "Der Zauberzwerg");
  const thread = await createForumThread("Wortkette", "write");

  const renamed = await request(
    "PATCH",
    `/api/groups/${group.id}/threads/${thread.id}`,
    memberCookie,
    { title: "Umbenannt" },
  );
  assertEquals(renamed.status, STATUS_CODE.NotFound);

  const moved = await request(
    "PUT",
    `/api/groups/${group.id}/threads/${thread.id}/folder`,
    memberCookie,
    { folderId: null },
  );
  assertEquals(moved.status, STATUS_CODE.NotFound);

  const deleted = await request(
    "DELETE",
    `/api/groups/${group.id}/threads/${thread.id}`,
    memberCookie,
  );
  assertEquals(deleted.status, STATUS_CODE.NotFound);

  // Still there, and still called what it was: a 404 that had already renamed it would pass the
  // three assertions above.
  const still = await request(
    "GET",
    `/api/forum/threads/${thread.id}`,
    memberCookie,
  );
  assertEquals(still.status, STATUS_CODE.OK);
  assertEquals((await still.json()).title, "Wortkette");
});
