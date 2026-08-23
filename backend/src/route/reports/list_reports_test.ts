import { assert, assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { db } from "@/src/database/client.ts";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";

const operator = "queue-test-operator";
const reporter = "queue-test-reporter";
const author = "queue-test-author";

Deno.test.beforeEach(clearRateLimits);

Deno.test.afterEach(async () => {
  const fixtureUsers = db
    .selectFrom("user")
    .select("id")
    .where("username", "in", [operator, reporter, author]);

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

  await deleteUsers([operator, reporter, author]);
});

async function registerOperator(): Promise<string> {
  const cookie = await registerUser(operator);
  await db
    .updateTable("user")
    .set({ platformRole: "moderator" })
    .where("username", "=", operator)
    .execute();
  return cookie;
}

const listReports = (cookie: string, body: Record<string, unknown> = {}) =>
  request("QUERY", "/api/reports", cookie, { limit: 50, offset: 0, ...body });

const report = (
  cookie: string,
  targetType: string,
  targetId: string,
  category = "harassment",
) =>
  request("POST", "/api/reports", cookie, {
    targetType,
    targetId,
    category,
    reason: "Grund",
  });

type Row = {
  id: string;
  targetExcerpt: string;
  category: string;
  status: string;
  reporterUsername: string | null;
  authorId: string | null;
  authorUsername: string | null;
  targetExists: boolean;
};

const rowsFor = async (cookie: string, body?: Record<string, unknown>) =>
  (await (await listReports(cookie, body)).json()).results as Row[];

/** A public group with one post in it, so there is something with an author to report. */
async function aPostBy(cookie: string) {
  const group = await createGroup(cookie, "Warteschlangenprobe", "public");
  const thread = await (await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    cookie,
    { title: "Thread" },
  )).json();
  const post = await (await request(
    "POST",
    `/api/groups/${group.id}/threads/${thread.id}/posts`,
    cookie,
    { text: "Etwas Übles." },
  )).json();
  return { group, thread, post };
}

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
  const { post } = await aPostBy(authorCookie);

  await report(reporterCookie, "writing_post", post.id);

  const row = (await rowsFor(operatorCookie, { status: "open" }))
    .find((r) => r.targetExcerpt === "Etwas Übles.");

  assertExists(row);
  assertEquals(row.reporterUsername, reporter);
  assertEquals(row.authorUsername, author);
  assertEquals(row.authorId, await getUserId(author));
  // Strictly a boolean, not 0/1: the type is narrowed with `$castTo`, which changes no SQL, so
  // this is what proves the SQL really answers a boolean rather than the type merely claiming it.
  assertEquals(typeof row.targetExists, "boolean");
  assertEquals(row.targetExists, true);
});

Deno.test("deleting the reported post keeps the author, so it can still be acted on", async () => {
  const operatorCookie = await registerOperator();
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const { group, thread, post } = await aPostBy(authorCookie);

  await report(reporterCookie, "writing_post", post.id);
  assertEquals(
    (await request(
      "DELETE",
      `/api/groups/${group.id}/threads/${thread.id}/posts/${post.id}`,
      authorCookie,
      undefined,
    )).status,
    STATUS_CODE.OK,
  );

  const row = (await rowsFor(operatorCookie, { status: "open" }))
    .find((r) => r.targetExcerpt === "Etwas Übles.");

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
  const { post } = await aPostBy(authorCookie);

  await report(reporterCookie, "writing_post", post.id, "spam");
  await report(reporterCookie, "user", authorId, "harassment");

  const spam = await rowsFor(operatorCookie, { category: "spam" });
  assert(spam.every((r) => r.category === "spam"));
  assert(spam.some((r) => r.targetExcerpt === "Etwas Übles."));

  const byType = await rowsFor(operatorCookie, { targetType: "user" });
  assert(byType.some((r) => r.targetExcerpt === author));
  assert(byType.every((r) => r.targetExcerpt !== "Etwas Übles."));
});

Deno.test("closing a report records who did it, and it closes only once", async () => {
  const operatorCookie = await registerOperator();
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const { post } = await aPostBy(authorCookie);

  await report(reporterCookie, "writing_post", post.id);
  const row = (await rowsFor(operatorCookie, { status: "open" }))
    .find((r) => r.targetExcerpt === "Etwas Übles.");
  assertExists(row);

  assertEquals(
    (await request("PATCH", `/api/reports/${row.id}`, operatorCookie, {
      status: "dismissed",
    })).status,
    STATUS_CODE.OK,
  );

  const stored = await db
    .selectFrom("report")
    .select(["status", "closedAt", "closedBy"])
    .where("id", "=", row.id)
    .executeTakeFirstOrThrow();

  assertEquals(stored.status, "dismissed");
  assertExists(stored.closedAt);
  assertEquals(stored.closedBy, await getUserId(operator));

  // Closing an already closed one answers 404 rather than overwriting who closed it.
  assertEquals(
    (await request("PATCH", `/api/reports/${row.id}`, operatorCookie, {
      status: "resolved",
    })).status,
    STATUS_CODE.NotFound,
  );
});

Deno.test("an ordinary member cannot close a report", async () => {
  const operatorCookie = await registerOperator();
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const { post } = await aPostBy(authorCookie);

  await report(reporterCookie, "writing_post", post.id);
  const row = (await rowsFor(operatorCookie, { status: "open" }))
    .find((r) => r.targetExcerpt === "Etwas Übles.");
  assertExists(row);

  assertEquals(
    (await request("PATCH", `/api/reports/${row.id}`, reporterCookie, {
      status: "dismissed",
    })).status,
    STATUS_CODE.Forbidden,
  );
});
