import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "#/src/http/status.ts";
import { clearRateLimits, getUserId, registerUser, request } from "#/src/test/support.ts";
import {
  aPostBy,
  cleanUpReports,
  fileReportOk,
  listReports,
  makeOperator,
  ownRow,
  reportFixture,
  rowsFor,
} from "#/src/test/reports.ts";

const { operator, reporter, author, reportedText } = reportFixture("list");

beforeEach(clearRateLimits);

afterEach(() => cleanUpReports([operator, reporter, author]));

const registerOperator = async () => makeOperator(operator, await registerUser(operator));

test("QUERY /api/reports is refused unless you are an operator", async () => {
  const memberCookie = await registerUser(reporter);

  assert.equal((await listReports(memberCookie)).status, STATUS_CODE.Forbidden);
});

test("the queue names who is answerable, not only what was said", async () => {
  const operatorCookie = await registerOperator();
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const { post } = await aPostBy(authorCookie, reportedText);

  await fileReportOk(reporterCookie, "writing_post", post.id);

  const row = await ownRow(operatorCookie, reportedText, { status: "open" });

  assert.ok(row);
  assert.equal(row.reporterUsername, reporter);
  assert.equal(row.authorUsername, author);
  assert.equal(row.authorId, await getUserId(author));
  // Strictly a boolean, not 0/1: the type is narrowed with `$castTo`, which changes no SQL, so
  // this is what proves the SQL really answers a boolean rather than the type merely claiming it.
  assert.equal(typeof row.targetExists, "boolean");
  assert.equal(row.targetExists, true);
});

test("a report nothing has happened to yet has no lifecycle to report", async () => {
  const operatorCookie = await registerOperator();
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const { post } = await aPostBy(authorCookie, reportedText);

  await fileReportOk(reporterCookie, "writing_post", post.id);

  const row = await ownRow(operatorCookie, reportedText, { status: "open" });

  assert.ok(row);
  // Filing is `created_at`, so nothing else is set: the status is derived from these two being
  // null, which is what makes `open` mean "nobody has touched this".
  assert.equal(row.status, "open");
  assert.equal(row.inProgressAt, null);
  assert.equal(row.closedAt, null);
  assert.equal(row.operatorUsername, null);
  assert.equal(row.closingOutcome, null);
  assert.equal(row.closingNote, null);
});

test("deleting the reported post keeps the author, so it can still be acted on", async () => {
  const operatorCookie = await registerOperator();
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const { group, thread, post } = await aPostBy(authorCookie, reportedText);

  await fileReportOk(reporterCookie, "writing_post", post.id);
  assert.equal(
    (
      await request(
        "DELETE",
        `/api/groups/${group.id}/threads/${thread.id}/posts/${post.id}`,
        authorCookie,
        undefined,
      )
    ).status,
    STATUS_CODE.OK,
  );

  const row = await ownRow(operatorCookie, reportedText, { status: "open" });

  assert.ok(row, "the report went with the post");
  // The whole point: the post is gone, and the operator can still see whose it was and reach
  // them. Without the author column this row would say "somebody wrote this" and stop there.
  assert.equal(row.authorUsername, author);
  assert.equal(row.targetExists, false);
});

test("the queue filters by status and category", async () => {
  const operatorCookie = await registerOperator();
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const authorId = await getUserId(author);
  const { post } = await aPostBy(authorCookie, reportedText);

  await fileReportOk(reporterCookie, "writing_post", post.id, "spam");
  await fileReportOk(reporterCookie, "user", authorId, "harassment");

  const spam = await rowsFor(operatorCookie, { category: "spam" });
  assert(spam.every((r) => r.category === "spam"));
  assert(spam.some((r) => r.targetExcerpt === reportedText));

  const byType = await rowsFor(operatorCookie, { targetType: "user" });
  assert(byType.some((r) => r.targetExcerpt === author));
  assert(byType.every((r) => r.targetExcerpt !== reportedText));
});
