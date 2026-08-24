import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { db } from "@/src/database/client.ts";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";
import {
  aPostBy,
  cleanUpReports,
  fileReport,
  makeOperator,
  moveReport,
  ownRow,
  reportFixture,
} from "@/src/test/reports.ts";

const { operator, otherOperator, reporter, author, reportedText } =
  reportFixture("move");

Deno.test.beforeEach(clearRateLimits);

Deno.test.afterEach(() =>
  cleanUpReports([operator, otherOperator, reporter, author])
);

const registerOperator = async (username: string) =>
  makeOperator(username, await registerUser(username));

/** The lifecycle as it is stored, which is two timestamps and what was decided. */
const stored = (reportId: string) =>
  db
    .selectFrom("report")
    .select([
      "status",
      "inProgressAt",
      "closedAt",
      "closingOutcome",
      "closingNote",
      "operatorId",
    ])
    .where("id", "=", reportId)
    .executeTakeFirstOrThrow();

/** An operator, a reporter, and one open report of a post by a third member. */
async function anOpenReport() {
  const operatorCookie = await registerOperator(operator);
  const authorCookie = await registerUser(author);
  const reporterCookie = await registerUser(reporter);
  const { post } = await aPostBy(authorCookie, reportedText);

  await fileReport(reporterCookie, "writing_post", post.id);
  const row = await ownRow(operatorCookie, reportedText, { status: "open" });
  assertExists(row);

  return { operatorCookie, reporterCookie, post, row };
}

Deno.test("taking a report records who has it", async () => {
  const { operatorCookie, row } = await anOpenReport();

  assertEquals(
    (await moveReport(operatorCookie, row.id, { status: "in_progress" }))
      .status,
    STATUS_CODE.OK,
  );

  const taken = await ownRow(operatorCookie, reportedText, {
    status: "in_progress",
  });
  assertExists(taken, "it is in the in-progress queue now");
  assertEquals(taken.operatorUsername, operator);
  assertExists(taken.inProgressAt);
  assertEquals(taken.closedAt, null);

  // The status is generated from the timestamps, so this is what proves the database derives it
  // rather than the application claiming it.
  assertEquals((await stored(row.id)).status, "in_progress");
});

Deno.test("a report already taken can be taken over", async () => {
  const { operatorCookie, row } = await anOpenReport();
  const otherCookie = await registerOperator(otherOperator);

  await moveReport(operatorCookie, row.id, { status: "in_progress" });
  // Deliberately allowed: the state says "somebody has this", and a claim nobody can take over
  // would strand the report the day its holder stopped reading the queue.
  assertEquals(
    (await moveReport(otherCookie, row.id, { status: "in_progress" })).status,
    STATUS_CODE.OK,
  );

  const held = await ownRow(otherCookie, reportedText, {
    status: "in_progress",
  });
  assertExists(held);
  assertEquals(held.operatorUsername, otherOperator);
});

Deno.test("taking a report still blocks the same member reporting it again", async () => {
  const { operatorCookie, reporterCookie, post, row } = await anOpenReport();

  await moveReport(operatorCookie, row.id, { status: "in_progress" });

  // The index predicate is `closed_at IS NULL` for this. While it asked for `open`, taking a
  // report dropped it out of the index and a second row appeared under the operator's hands.
  assertEquals(
    (await request("POST", "/api/reports", reporterCookie, {
      targetType: "writing_post",
      targetId: post.id,
      category: "harassment",
      reason: "Nochmal.",
    })).status,
    STATUS_CODE.OK,
  );

  const rows = await db
    .selectFrom("report")
    .select(["id", "reason", "status"])
    .where("reportedWritingPostId", "=", post.id)
    .execute();

  assertEquals(rows.length, 1);
  assertEquals(rows[0]?.reason, "Nochmal.");
  // And it is still the one being worked on, not reset by the re-report.
  assertEquals(rows[0]?.status, "in_progress");
});

Deno.test("closing a report records the outcome and what was decided", async () => {
  const { operatorCookie, row } = await anOpenReport();

  await moveReport(operatorCookie, row.id, { status: "in_progress" });
  assertEquals(
    (await moveReport(operatorCookie, row.id, {
      status: "closed",
      outcome: "warning_given",
      note: "Autor angeschrieben, erste Verwarnung.",
    })).status,
    STATUS_CODE.OK,
  );

  const kept = await stored(row.id);
  assertEquals(kept.status, "closed");
  assertEquals(kept.closingOutcome, "warning_given");
  assertEquals(kept.closingNote, "Autor angeschrieben, erste Verwarnung.");
  // Taking it is not erased by closing it: both moments stay, which is the whole of the record
  // now that there is no table beside the report.
  assertExists(kept.inProgressAt);
  assertExists(kept.closedAt);

  const closed = await ownRow(operatorCookie, reportedText, {
    status: "closed",
  });
  assertExists(closed);
  assertEquals(closed.closingOutcome, "warning_given");
  assertEquals(closed.operatorUsername, operator);
});

Deno.test("closing one nobody took records who closed it, and no taking", async () => {
  const { operatorCookie, row } = await anOpenReport();

  assertEquals(
    (await moveReport(operatorCookie, row.id, {
      status: "closed",
      outcome: "duplicate",
      note: "Schon gemeldet.",
    })).status,
    STATUS_CODE.OK,
  );

  const kept = await stored(row.id);
  assertEquals(kept.status, "closed");
  // Honest about what happened: nobody took it, so there is no taking to report — and the
  // operator is still recorded, because closing sets it either way.
  assertEquals(kept.inProgressAt, null);
  assertExists(kept.operatorId);
});

Deno.test("a closing has to say something", async () => {
  const { operatorCookie, row } = await anOpenReport();

  // The note is what the next operator to meet this reporter reads, so an outcome alone is not a
  // closing. The union in the body is what makes it required rather than a check in the handler.
  assertEquals(
    (await moveReport(operatorCookie, row.id, {
      status: "closed",
      outcome: "no_violation",
    })).status,
    STATUS_CODE.BadRequest,
  );

  assertEquals((await stored(row.id)).status, "open");
});

Deno.test("only the operator holding a report may close it", async () => {
  const { operatorCookie, row } = await anOpenReport();
  const otherCookie = await registerOperator(otherOperator);

  await moveReport(operatorCookie, row.id, { status: "in_progress" });

  // 409, so two operators cannot both judge one case. Taking it over first is the way through.
  assertEquals(
    (await moveReport(otherCookie, row.id, {
      status: "closed",
      outcome: "no_violation",
      note: "Nichts dran.",
    })).status,
    STATUS_CODE.Conflict,
  );

  assertEquals((await stored(row.id)).status, "in_progress");
});

Deno.test("a report whose operator is gone can be closed by anybody", async () => {
  const { operatorCookie, row } = await anOpenReport();
  const otherCookie = await registerOperator(otherOperator);

  await moveReport(operatorCookie, row.id, { status: "in_progress" });
  await deleteUsers([operator]);

  // `operator_id` is SET NULL, and that is the whole of the escape hatch: a report held by
  // nobody is held by nobody, so it is not stuck.
  assertEquals(
    (await moveReport(otherCookie, row.id, {
      status: "closed",
      outcome: "target_gone",
      note: "Inhalt war schon weg.",
    })).status,
    STATUS_CODE.OK,
  );

  const kept = await stored(row.id);
  assertEquals(kept.status, "closed");
  assertEquals(kept.closingOutcome, "target_gone");
});

Deno.test("a closed report is final", async () => {
  const { operatorCookie, row } = await anOpenReport();

  await moveReport(operatorCookie, row.id, {
    status: "closed",
    outcome: "no_violation",
    note: "Nichts dran.",
  });

  // Neither closing it again nor taking it back: there is no reopening, and both answer 409
  // rather than quietly overwriting what was decided.
  assertEquals(
    (await moveReport(operatorCookie, row.id, {
      status: "closed",
      outcome: "content_removed",
      note: "Doch.",
    })).status,
    STATUS_CODE.Conflict,
  );
  assertEquals(
    (await moveReport(operatorCookie, row.id, { status: "in_progress" }))
      .status,
    STATUS_CODE.Conflict,
  );

  const kept = await stored(row.id);
  assertEquals(kept.closingOutcome, "no_violation");
  assertEquals(kept.closingNote, "Nichts dran.");
});

Deno.test("an ordinary member cannot move a report", async () => {
  const { reporterCookie, row } = await anOpenReport();

  assertEquals(
    (await moveReport(reporterCookie, row.id, { status: "in_progress" }))
      .status,
    STATUS_CODE.Forbidden,
  );
});

Deno.test("moving a report that does not exist is a 404", async () => {
  const operatorCookie = await registerOperator(operator);

  assertEquals(
    (await moveReport(
      operatorCookie,
      "01a00000-0000-7000-8000-00000000ffff",
      { status: "in_progress" },
    )).status,
    STATUS_CODE.NotFound,
  );
});
