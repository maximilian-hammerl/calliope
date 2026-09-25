---
paths:
  - "backend/src/route/reports/**"
  - "backend/src/service/report_service.ts"
  - "backend/src/service/ban_service.ts"
---

# The report lifecycle

A report is `open`, `in_progress` or `closed`; `PATCH /reports/{reportId}` is the one route that
moves it. Two moves — taking and closing — and **no reopening**. The body is a discriminated union
on the destination, so the document itself says a closing carries an outcome and a note; a `refine`
would enforce the same rule invisibly.

**No table beside the report, because the lifecycle only goes forward.** Every move is written
once and nothing is overwritten, so the row *is* the record §16 asks for.

- **`status` is a generated column** over `in_progress_at` and `closed_at`, typed
  `Generated<ReportStatus>` so nothing can write it. Spelled out by hand, the queue's filter is
  three predicates where forgetting `closed_at IS NULL` silently includes every closed report.
- **A CHECK on this table cannot reference `status`**, nor can a partial index — both are written
  against `closed_at`.
- **There is no `opened_at`**; `created_at` is it.
- **Taking a report somebody holds is allowed** and hands it over — a claim nobody could take over
  would strand a report the day its holder stopped reading the queue.
- **Only the holder may close it**; the loser gets 409. `operator_id` is `SET NULL`, so a report
  whose holder left is held by nobody and anybody may close it. Closing sets `operator_id` either way.

**The category is part of the one-open-report-per-member index key** — the line between correcting
a report and making a second claim. Two consequences, and the second has bitten three times: the
predicate is `closed_at IS NULL`, not a status, or taking a report would let the same member file it
again; and `insertReport`'s `ON CONFLICT` has to restate that predicate *the same way*, or Postgres
answers "no unique or exclusion constraint matching the ON CONFLICT specification" for every report.
**The same way includes literals** — `eb.lit(1)`, never a bound `1`. A parameter matches the index's
`= 1` only until a prepared statement goes to a generic plan, and then reporting fails intermittently.

`report_outcome` says which kind of closing it was — `content_removed`, `no_violation`, `duplicate`
and six more. The enum is what the queue filters on; the note is what the next operator reads.
