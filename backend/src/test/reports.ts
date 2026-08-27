import { db } from "@/src/database/client.ts";
import {
  createGroup,
  deleteUsers,
  postBody,
  request,
} from "@/src/test/support.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";

/**
 * Four accounts and one reported text per test file, all named by `scope`. The suite runs
 * `--parallel`, so shared names would have each file's `afterEach` deleting accounts the other was
 * still using — and a shared *excerpt* is just as bad, because that is what these tests find their
 * own row in the queue by. Three files reporting a post that said the same thing had each of them
 * picking up another's report and answering 404 once it was cleaned up.
 */
export function reportFixture(scope: string) {
  // A long scope pushes the name past TEXT_LIMIT.username, and registration then fails in
  // whichever test happens to run first rather than saying what is wrong.
  if (`report-${scope}-operator2`.length > TEXT_LIMIT.username) {
    throw new Error(
      `Scope "${scope}" makes a username longer than ${TEXT_LIMIT.username}`,
    );
  }

  return {
    operator: `report-${scope}-operator`,
    // A second operator, because the rules about who may close a report need two of them.
    otherOperator: `report-${scope}-operator2`,
    reporter: `report-${scope}-reporter`,
    author: `report-${scope}-author`,
    // What the reported post says, which is how a test finds its own row among everyone else's.
    reportedText: `Etwas Übles (${scope}).`,
  };
}

/**
 * Registers the operator and gives them the role. A moderator rather than an administrator,
 * because everything here is authorised as the lower of the two.
 */
export async function makeOperator(
  username: string,
  cookie: string,
): Promise<string> {
  await db
    .updateTable("user")
    .set({ platformRole: "moderator" })
    .where("username", "=", username)
    .execute();
  return cookie;
}

export const listReports = (
  cookie: string,
  body: Record<string, unknown> = {},
) =>
  request("QUERY", "/api/reports", cookie, { limit: 50, offset: 0, ...body });

export const fileReport = (
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

export const moveReport = (
  cookie: string,
  reportId: string,
  body: Record<string, unknown>,
) => request("PATCH", `/api/reports/${reportId}`, cookie, body);

export type Row = {
  id: string;
  targetExcerpt: string;
  reason: string;
  category: string;
  status: string;
  inProgressAt: string | null;
  closedAt: string | null;
  closingOutcome: string | null;
  closingNote: string | null;
  operatorUsername: string | null;
  reporterUsername: string | null;
  authorId: string | null;
  authorUsername: string | null;
  targetExists: boolean;
};

export const rowsFor = async (
  cookie: string,
  body?: Record<string, unknown>,
) => (await (await listReports(cookie, body)).json()).results as Row[];

/** The caller's own report of the reported post, found by what that post says. */
export const ownRow = async (
  cookie: string,
  reportedText: string,
  body?: Record<string, unknown>,
) =>
  (await rowsFor(cookie, body)).find((row) =>
    row.targetExcerpt === reportedText
  );

/** A public group with one post in it, so there is something with an author to report. */
export async function aPostBy(cookie: string, reportedText: string) {
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
    postBody(reportedText),
  )).json();
  return { group, thread, post };
}

/**
 * Removes the fixture's reports and accounts. Scoped to the names it is given, never emptying
 * `report` — another file's rows are in there too, and the suite runs in parallel.
 */
export async function cleanUpReports(usernames: string[]) {
  const fixtureUsers = db
    .selectFrom("user")
    .select("id")
    .where("username", "in", usernames);

  // Also by `operatorId`, because a report an operator only ever *closed* has none of the three
  // references below pointing at this fixture.
  await db
    .deleteFrom("report")
    .where((eb) =>
      eb.or([
        eb("reporterId", "in", fixtureUsers),
        eb("reportedUserId", "in", fixtureUsers),
        eb("reportedAuthorId", "in", fixtureUsers),
        eb("operatorId", "in", fixtureUsers),
      ])
    )
    .execute();

  await deleteUsers(usernames);
}
