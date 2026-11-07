import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanUp,
  client,
  connect,
  firstRow,
  insertReport,
  insertUser,
  reportStatus,
} from "./support.ts";

beforeEach(connect);
afterEach(cleanUp);

/** A reporter and the member they reported, which is all a report needs. */
async function twoMembers(
  name: string,
): Promise<{ reporterId: string; reportedId: string }> {
  return {
    reporterId: await insertUser(`${name}-reporter`),
    reportedId: await insertUser(`${name}-reported`),
  };
}

const A_CLOSING = {
  closedAt: "2026-08-24T10:00:00Z",
  closingOutcome: "no_violation",
  closingNote: "Nichts dran.",
};

test("the status is derived from the timestamps, never written", async () => {
  const { reporterId, reportedId } = await twoMembers("report-derived");

  // A category each, because two non-closed reports of one thing by one member is exactly what
  // the unique index refuses - see the last test in this file.
  const open = await insertReport(reporterId, reportedId);
  const taken = await insertReport(reporterId, reportedId, {
    category: "spam",
    inProgressAt: "2026-08-24T09:00:00Z",
  });
  const closed = await insertReport(reporterId, reportedId, {
    category: "hate",
    inProgressAt: "2026-08-24T09:00:00Z",
    ...A_CLOSING,
  });

  assert.equal(await reportStatus(open), "open");
  assert.equal(await reportStatus(taken), "in_progress");
  assert.equal(await reportStatus(closed), "closed");

  // Closing wins over taking, which is what makes the order of the CASE load-bearing: a report
  // that was taken and then closed is closed, not still in somebody's hands.
  assert.equal(await reportStatus(closed), "closed");
});

test("nothing can write the status itself", async () => {
  const { reporterId, reportedId } = await twoMembers("report-generated");
  const id = await insertReport(reporterId, reportedId);

  // A generated column refuses assignment outright, which is what makes it impossible for the
  // status and the timestamps to disagree.
  await assert.rejects(() =>
    client.query(
      `UPDATE public.report SET status = 'closed'::public.report_status WHERE id = $1`,
      [id],
    ), { message: /can only be updated to DEFAULT/u });

  assert.equal(await reportStatus(id), "open");
});

test("a closed report has to say how it turned out", async () => {
  const { reporterId, reportedId } = await twoMembers("report-closed");

  // A closing time on its own is not a closing: the outcome is what the queue filters on and the
  // note is what the next operator reads.
  await assert.rejects(() =>
    insertReport(reporterId, reportedId, {
      closedAt: "2026-08-24T10:00:00Z",
    }), { message: /report_closed_has_an_outcome/u });

  await assert.rejects(() =>
    insertReport(reporterId, reportedId, {
      category: "spam",
      closedAt: "2026-08-24T10:00:00Z",
      closingOutcome: "no_violation",
    }), { message: /report_closed_has_an_outcome/u });
});

test("a report that is not closed carries neither outcome nor note", async () => {
  const { reporterId, reportedId } = await twoMembers("report-outcome");

  for (
    const extra of [
      { category: "spam", closingOutcome: "no_violation" },
      { category: "hate", closingNote: "Etwas entschieden." },
    ]
  ) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    await assert.rejects(() => insertReport(reporterId, reportedId, extra), {
      message: /report_closed_has_an_outcome/u,
    });
  }
});

test("a report may be worked on without being closed", async () => {
  const { reporterId, reportedId } = await twoMembers("report-progress");

  const id = await insertReport(reporterId, reportedId, {
    inProgressAt: "2026-08-24T09:00:00Z",
  });

  // The state the old `report_closed_has_a_time` could not express at all: being worked on is
  // neither open nor closed, and that constraint demanded a closing time for it.
  assert.equal(await reportStatus(id), "in_progress");
});

test("a closing cannot predate the taking it followed", async () => {
  const { reporterId, reportedId } = await twoMembers("report-order");

  await assert.rejects(() =>
    insertReport(reporterId, reportedId, {
      inProgressAt: "2026-08-24T10:00:00Z",
      closedAt: "2026-08-24T09:00:00Z",
      closingOutcome: "no_violation",
      closingNote: "Nichts dran.",
    }), { message: /report_closed_after_taken/u });
});

test("the operator goes, and what they did stays", async () => {
  const { reporterId, reportedId } = await twoMembers("report-operator");
  const operatorId = await insertUser("report-operator-op");
  const id = await insertReport(reporterId, reportedId, {
    inProgressAt: "2026-08-24T09:00:00Z",
    ...A_CLOSING,
    operatorId,
  });

  await client.query(`DELETE FROM public."user" WHERE id = $1`, [operatorId]);

  const { rows } = await client.query<
    { operator_id: string | null; closing_outcome: string | null }
  >(
    `SELECT operator_id, closing_outcome FROM public.report WHERE id = $1`,
    [id],
  );

  // SET NULL, like every other actor here: the closing is still readable, and the report is now
  // held by nobody - which is also what lets any operator close one left in progress.
  assert.equal(firstRow(rows).operator_id, null);
  assert.equal(firstRow(rows).closing_outcome, "no_violation");
  assert.equal(await reportStatus(id), "closed");
});

test("one report per member per thing per category, until it is closed", async () => {
  const { reporterId, reportedId } = await twoMembers("report-unique");

  await insertReport(reporterId, reportedId);

  // Taking it changes nothing about that: the index is keyed on `closed_at IS NULL`, so a report
  // in somebody's hands still blocks a duplicate.
  await client.query(
    `UPDATE public.report SET in_progress_at = now() WHERE reporter_id = $1`,
    [reporterId],
  );

  await assert.rejects(() => insertReport(reporterId, reportedId), {
    message: /report_one_open_per_reporter_and_category_idx/u,
  });

  // Closed, it stops blocking: if the same thing happens again it can be reported again.
  await client.query(
    `UPDATE public.report
     SET closed_at = now(), closing_outcome = 'no_violation', closing_note = 'Nichts dran.'
     WHERE reporter_id = $1`,
    [reporterId],
  );

  assert.equal(
    await reportStatus(await insertReport(reporterId, reportedId)),
    "open",
  );
});
