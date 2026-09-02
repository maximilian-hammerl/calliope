import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import { db } from "@/src/database/client.ts";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  postBody,
  registerUser,
  request,
} from "@/src/test/support.ts";

// Its own accounts: the suite runs in parallel, so shared names collide.
const reporter = "report-test-reporter";
const author = "report-test-author";
const outsider = "report-test-outsider";

/**
 * Its own text too, not only its own accounts. One test below finds its report by the excerpt, and
 * while three files all reported a post saying "Etwas Übles." it could pick up a neighbour's row
 * and then fail on it.
 */
const REPORTED_TEXT = "Etwas Übles (create).";

Deno.test.beforeEach(clearRateLimits);

/**
 * Reports outlive their reporter by design — that is the feature — so `deleteUsers` leaves them
 * behind and a development database quietly fills with orphans. They go first, while they can
 * still be found by who filed them.
 */
Deno.test.afterEach(async () => {
  const fixtureUsers = db
    .selectFrom("user")
    .select("id")
    .where("username", "in", [reporter, author, outsider]);

  await db
    .deleteFrom("report")
    .where((eb) =>
      eb.or([
        eb("reporterId", "in", fixtureUsers),
        eb("reportedUserId", "in", fixtureUsers),
        eb("reportedAuthorId", "in", fixtureUsers),
      ])
    )
    .execute();

  await deleteUsers([reporter, author, outsider]);
});

const report = (
  cookie: string,
  targetType: string,
  targetId: string,
  reason = "Beleidigend",
  category = "harassment",
) =>
  request("POST", "/api/reports", cookie, {
    targetType,
    targetId,
    category,
    reason,
  });

async function thread(cookie: string, groupId: string, title: string) {
  const response = await request(
    "POST",
    `/api/groups/${groupId}/threads`,
    cookie,
    { title },
  );
  assertEquals(response.status, STATUS_CODE.Created);
  return await response.json();
}

async function post(
  cookie: string,
  groupId: string,
  threadId: string,
  text: string,
) {
  const response = await request(
    "POST",
    `/api/groups/${groupId}/threads/${threadId}/posts`,
    cookie,
    postBody(text),
  );
  assertEquals(response.status, STATUS_CODE.Created);
  return await response.json();
}

const storedFor = (targetId: string) =>
  db
    .selectFrom("report")
    .selectAll()
    .where((eb) =>
      eb.or([
        eb("reportedWritingPostId", "=", targetId),
        eb("reportedWritingPageId", "=", targetId),
        eb("reportedWritingGroupId", "=", targetId),
        eb("reportedUserId", "=", targetId),
      ])
    )
    .executeTakeFirst();

Deno.test("POST /api/reports copies what was reported into the report", async () => {
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);

  const group = await createGroup(authorCookie, "Öffentliche Gruppe", "public");
  const created = await thread(authorCookie, group.id, "Ein Thread");
  const written = await post(
    authorCookie,
    group.id,
    created.id,
    REPORTED_TEXT,
  );

  assertEquals(
    (await report(reporterCookie, "writing_post", written.id)).status,
    STATUS_CODE.OK,
  );

  const stored = await storedFor(written.id);
  assertExists(stored);
  // The excerpt is the point: the queue has to stay readable after the post is deleted, and it
  // has to be the server's copy rather than one the reporter composed.
  assertEquals(stored.targetExcerpt, REPORTED_TEXT);
  assertEquals(stored.reason, "Beleidigend");
  assertEquals(stored.category, "harassment");
  assertEquals(stored.status, "open");
});

Deno.test("a report survives the post it is about", async () => {
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);

  const group = await createGroup(authorCookie, "Öffentliche Gruppe", "public");
  const created = await thread(authorCookie, group.id, "Ein Thread");
  const written = await post(
    authorCookie,
    group.id,
    created.id,
    REPORTED_TEXT,
  );
  await report(reporterCookie, "writing_post", written.id);

  // Deleting your own post the moment it is reported must not erase the evidence.
  assertEquals(
    (await request(
      "DELETE",
      `/api/groups/${group.id}/threads/${created.id}/posts/${written.id}`,
      authorCookie,
      undefined,
    )).status,
    STATUS_CODE.OK,
  );

  const stored = await db
    .selectFrom("report")
    .selectAll()
    .where("targetExcerpt", "=", REPORTED_TEXT)
    .executeTakeFirst();

  assertExists(stored, "the report went with the post");
  assertEquals(stored.reportedWritingPostId, null);
  assertEquals(stored.targetType, "writing_post");
});

Deno.test("what the reporter cannot see cannot be reported", async () => {
  const authorCookie = await registerUser(author);
  const outsiderCookie = await registerUser(outsider);

  const group = await createGroup(authorCookie, "Private Gruppe", "private");
  const created = await thread(authorCookie, group.id, "Geheim");

  // 404, not 403: answering differently would make reporting a way to discover that a private
  // group's thread exists.
  assertEquals(
    (await report(outsiderCookie, "writing_thread", created.id)).status,
    STATUS_CODE.NotFound,
  );
  assertEquals(
    (await report(outsiderCookie, "writing_group", group.id)).status,
    STATUS_CODE.NotFound,
  );
});

Deno.test("reporting the same thing under the same category rewrites the reason", async () => {
  await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const authorId = await getUserId(author);

  // Half a sentence submitted by a stray Enter, then said properly.
  assertEquals(
    (await report(reporterCookie, "user", authorId, "Beleidig")).status,
    STATUS_CODE.OK,
  );
  assertEquals(
    (await report(reporterCookie, "user", authorId, "Beleidigend, mehrfach."))
      .status,
    STATUS_CODE.OK,
  );

  const stored = await db
    .selectFrom("report")
    .selectAll()
    .where("reportedUserId", "=", authorId)
    .execute();

  // One report, and it says what the reporter meant to say.
  assertEquals(stored.length, 1);
  assertEquals(stored[0]?.reason, "Beleidigend, mehrfach.");
});

Deno.test("reporting the same thing under another category is a second claim", async () => {
  await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const authorId = await getUserId(author);

  assertEquals(
    (await report(reporterCookie, "user", authorId, "Beleidigend"))
      .status,
    STATUS_CODE.OK,
  );
  assertEquals(
    (await report(
      reporterCookie,
      "user",
      authorId,
      "Und abgeschrieben.",
      "plagiarism",
    ))
      .status,
    STATUS_CODE.OK,
  );

  const stored = await db
    .selectFrom("report")
    .selectAll()
    .where("reportedUserId", "=", authorId)
    .execute();

  // Two rows, because a different category is a different claim rather than a correction. The
  // category is in the index key for exactly this: while it was not, noticing a second thing
  // wrong overwrote the first report and lost it.
  assertEquals(stored.length, 2);
  assertEquals(
    stored.map((row) => row.category).toSorted(),
    ["harassment", "plagiarism"],
  );
});

Deno.test("re-reporting keeps the excerpt from when it was first reported", async () => {
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);

  const group = await createGroup(authorCookie, "Öffentliche Gruppe", "public");
  const created = await thread(authorCookie, group.id, "Ein Thread");
  const written = await post(
    authorCookie,
    group.id,
    created.id,
    REPORTED_TEXT,
  );

  await report(reporterCookie, "writing_post", written.id, "Kurz");

  // The author edits it to something innocuous, then the reporter says more.
  assertEquals(
    (await request(
      "PATCH",
      `/api/groups/${group.id}/threads/${created.id}/posts/${written.id}`,
      authorCookie,
      postBody("Harmlos."),
    )).status,
    STATUS_CODE.OK,
  );
  await report(reporterCookie, "writing_post", written.id, "Ausführlicher");

  const stored = await storedFor(written.id);
  assertExists(stored);
  assertEquals(stored.reason, "Ausführlicher");
  // Editing what was reported must not let the author overwrite the evidence.
  assertEquals(stored.targetExcerpt, REPORTED_TEXT);
});

Deno.test("a second member reporting the same thing is its own report", async () => {
  await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const outsiderCookie = await registerUser(outsider);
  const authorId = await getUserId(author);

  await report(reporterCookie, "user", authorId);

  // The count of separate reporters is the signal an operator wants; only one member filing
  // twice is the slip worth refusing.
  assertEquals(
    (await report(outsiderCookie, "user", authorId)).status,
    STATUS_CODE.OK,
  );
});

Deno.test("two members reporting the same thing can both still delete their accounts", async () => {
  await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const outsiderCookie = await registerUser(outsider);
  const authorId = await getUserId(author);

  await report(reporterCookie, "user", authorId);
  await report(outsiderCookie, "user", authorId);

  // Both rows lose their reporter, which under NULLS NOT DISTINCT made them the same key and
  // failed the *deletion* — a member unable to leave because somebody else reported the same
  // thing they did. The index only covers live reporters for this reason.
  await db
    .deleteFrom("user")
    .where("username", "in", [reporter, outsider])
    .execute();

  const surviving = await db
    .selectFrom("report")
    .select(db.fn.countAll().as("count"))
    .where("reportedUserId", "=", authorId)
    .executeTakeFirstOrThrow();
  assertEquals(
    Number(surviving.count),
    2,
    "the reports went with their reporters",
  );
});

Deno.test("reporting your own account is refused", async () => {
  const reporterCookie = await registerUser(reporter);

  assertEquals(
    (await report(reporterCookie, "user", await getUserId(reporter))).status,
    STATUS_CODE.Forbidden,
  );
});

Deno.test("reporting your own writing is refused, whatever kind it is", async () => {
  const authorCookie = await registerUser(author);

  const group = await createGroup(authorCookie, "Eigene Gruppe", "public");
  const created = await thread(authorCookie, group.id, "Eigener Thread");
  const written = await post(
    authorCookie,
    group.id,
    created.id,
    "Eigener Text.",
  );

  // One check covers every kind because each resolves an author, so all three go through the
  // same refusal rather than three copies of it.
  for (
    const [targetType, targetId] of [
      ["writing_group", group.id],
      ["writing_thread", created.id],
      ["writing_post", written.id],
    ] as const
  ) {
    assertEquals(
      // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
      (await report(authorCookie, targetType, targetId)).status,
      STATUS_CODE.Forbidden,
      `${targetType} should not be reportable by its own author`,
    );
  }
});

Deno.test("somebody else's writing in the same group is still reportable", async () => {
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);

  const group = await createGroup(authorCookie, "Öffentliche Gruppe", "public");
  const created = await thread(authorCookie, group.id, "Ein Thread");
  const written = await post(
    authorCookie,
    group.id,
    created.id,
    REPORTED_TEXT,
  );

  // The refusal must not have been widened into "anything in a group you wrote in".
  assertEquals(
    (await report(reporterCookie, "writing_post", written.id)).status,
    STATUS_CODE.OK,
  );
});

Deno.test("POST /api/reports needs a session", async () => {
  const response = await request("POST", "/api/reports", "", {
    targetType: "user",
    targetId: crypto.randomUUID(),
    category: "other",
    reason: "x",
  });

  assertEquals(response.status, STATUS_CODE.Unauthorized);
});

Deno.test("a page can be reported, and the queue keeps its prose", async () => {
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const group = await createGroup(authorCookie, "Öffentliche Gruppe", "public");

  const page = await (await request(
    "POST",
    `/api/groups/${group.id}/pages`,
    authorCookie,
    { title: "Die Bergstadt", document: plainTextToDocument(REPORTED_TEXT) },
  )).json();

  assertEquals(
    (await report(reporterCookie, "writing_page", page.id)).status,
    STATUS_CODE.OK,
  );

  const stored = await storedFor(page.id);
  assertExists(stored);
  // The prose, not the title: the excerpt is what an operator reads once the page is gone.
  assertEquals(stored.targetExcerpt, REPORTED_TEXT);
  assertEquals(stored.reportedWritingPageId, page.id);
  assertEquals(stored.status, "open");
});

Deno.test("a page in a private group cannot be reported by an outsider", async () => {
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const group = await createGroup(authorCookie, "Private Gruppe", "private");
  const page = await (await request(
    "POST",
    `/api/groups/${group.id}/pages`,
    authorCookie,
    { title: "Geheim", document: plainTextToDocument(REPORTED_TEXT) },
  )).json();

  // The same answer a thing that does not exist gets, so reporting cannot be used to discover it.
  assertEquals(
    (await report(reporterCookie, "writing_page", page.id)).status,
    STATUS_CODE.NotFound,
  );
});
