import { assert, assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";
import {
  aPostBy,
  cleanUpReports,
  fileReport,
  listReports,
  makeOperator,
  ownRow,
  reportFixture,
  rowsFor,
} from "@/src/test/reports.ts";

const { operator, reporter, author, reportedText } = reportFixture("list");

Deno.test.beforeEach(clearRateLimits);

Deno.test.afterEach(() => cleanUpReports([operator, reporter, author]));

const registerOperator = async () =>
  makeOperator(operator, await registerUser(operator));

Deno.test("QUERY /api/reports is refused unless you are an operator", async () => {
  const memberCookie = await registerUser(reporter);

  assertEquals(
    (await listReports(memberCookie)).status,
    STATUS_CODE.Forbidden,
  );
});

Deno.test("the queue names who is answerable, not only what was said", async () => {
  const operatorCookie = await registerOperator();
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const { post } = await aPostBy(authorCookie, reportedText);

  await fileReport(reporterCookie, "writing_post", post.id);

  const row = await ownRow(operatorCookie, reportedText, { status: "open" });

  assertExists(row);
  assertEquals(row.reporterUsername, reporter);
  assertEquals(row.authorUsername, author);
  assertEquals(row.authorId, await getUserId(author));
  // Strictly a boolean, not 0/1: the type is narrowed with `$castTo`, which changes no SQL, so
  // this is what proves the SQL really answers a boolean rather than the type merely claiming it.
  assertEquals(typeof row.targetExists, "boolean");
  assertEquals(row.targetExists, true);
});

Deno.test("a report nothing has happened to yet has no lifecycle to report", async () => {
  const operatorCookie = await registerOperator();
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const { post } = await aPostBy(authorCookie, reportedText);

  await fileReport(reporterCookie, "writing_post", post.id);

  const row = await ownRow(operatorCookie, reportedText, { status: "open" });

  assertExists(row);
  // Filing is `created_at`, so nothing else is set: the status is derived from these two being
  // null, which is what makes `open` mean "nobody has touched this".
  assertEquals(row.status, "open");
  assertEquals(row.inProgressAt, null);
  assertEquals(row.closedAt, null);
  assertEquals(row.operatorUsername, null);
  assertEquals(row.closingOutcome, null);
  assertEquals(row.closingNote, null);
});

Deno.test("deleting the reported post keeps the author, so it can still be acted on", async () => {
  const operatorCookie = await registerOperator();
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const { group, thread, post } = await aPostBy(authorCookie, reportedText);

  await fileReport(reporterCookie, "writing_post", post.id);
  assertEquals(
    (await request(
      "DELETE",
      `/api/groups/${group.id}/threads/${thread.id}/posts/${post.id}`,
      authorCookie,
      undefined,
    )).status,
    STATUS_CODE.OK,
  );

  const row = await ownRow(operatorCookie, reportedText, { status: "open" });

  assertExists(row, "the report went with the post");
  // The whole point: the post is gone, and the operator can still see whose it was and reach
  // them. Without the author column this row would say "somebody wrote this" and stop there.
  assertEquals(row.authorUsername, author);
  assertEquals(row.targetExists, false);
});

Deno.test("the queue filters by status and category", async () => {
  const operatorCookie = await registerOperator();
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const authorId = await getUserId(author);
  const { post } = await aPostBy(authorCookie, reportedText);

  await fileReport(reporterCookie, "writing_post", post.id, "spam");
  await fileReport(reporterCookie, "user", authorId, "harassment");

  const spam = await rowsFor(operatorCookie, { category: "spam" });
  assert(spam.every((r) => r.category === "spam"));
  assert(spam.some((r) => r.targetExcerpt === reportedText));

  const byType = await rowsFor(operatorCookie, { targetType: "user" });
  assert(byType.some((r) => r.targetExcerpt === author));
  assert(byType.every((r) => r.targetExcerpt !== reportedText));
});
