import { db } from "@/src/database/client.ts";
import type {
  ReportCategory,
  ReportOutcome,
  ReportStatus,
  ReportTargetType,
} from "@/src/database/schema.ts";
import type { ListQuery, ListResults } from "@/src/list/list_endpoint_query.ts";
import { listResultsWithCount } from "@/src/list/list_endpoint_query.ts";
import type { User } from "@/src/service/user_service.ts";
import { resolveVisibleTarget } from "@/src/service/visible_target.ts";

/**
 * What a member has reported to the operators.
 *
 * Two rules run through all of it. **You can only report what you can see** — every kind is
 * resolved through the same check that guards reading it, so a report cannot be used to find out
 * whether something exists. And **the excerpt is written here, never sent by the client**: a
 * snapshot composed by the person filing the report would be evidence they wrote themselves.
 */

/** The column the target's id goes in, which `report_target_matches_type` also enforces. */
const TARGET_COLUMN = {
  writing_group: "reportedWritingGroupId",
  writing_thread: "reportedWritingThreadId",
  writing_post: "reportedWritingPostId",
  writing_page: "reportedWritingPageId",
  story_idea: "reportedStoryIdeaId",
  chat_group: "reportedChatGroupId",
  chat_message: "reportedChatMessageId",
  user: "reportedUserId",
} as const satisfies Record<ReportTargetType, string>;

export type ReportRefusal = "not_found" | "own_account" | "own_content";

async function insertReport(
  user: User,
  targetType: ReportTargetType,
  targetId: string,
  category: ReportCategory,
  reason: string,
): Promise<ReportRefusal | undefined> {
  if (targetType === "user" && targetId === user.id) {
    return "own_account";
  }

  // Reporting is the caller that wants the excerpt: it is the copy of what was said that keeps
  // the queue readable once the content is gone.
  const target = await resolveVisibleTarget(user, targetType, targetId, {
    withExcerpt: true,
  });

  if (target === undefined) {
    return "not_found";
  }

  // Once here rather than per target type: every branch resolves an author, and the interface
  // already hides the action on one's own writing.
  if (target.authorId !== null && target.authorId === user.id) {
    return "own_content";
  }

  // Reporting the same thing under the same category again rewrites the reason rather than being
  // refused: half a sentence submitted by a stray Enter is the likely way it happens, and saying
  // it again is the member's only way to fix it. Under a *different* category it is a second
  // claim rather than a correction, so it inserts a row of its own — see the index.
  //
  // One statement, so two reports racing cannot both insert. The ON CONFLICT clause has to
  // restate the index's own predicate because that index is partial — and it has to say it the
  // *same way*: `closed_at IS NULL` rather than a status, since the status is a generated column
  // and a partial index cannot carry one. Any disagreement and Postgres answers "no unique or
  // exclusion constraint matching the ON CONFLICT specification" for every report ever filed.
  // It is spelled through `eb.fn` rather than a raw `sql` template so the column names stay
  // checked.
  await db
    .insertInto("report")
    .values({
      reporterId: user.id,
      targetType,
      [TARGET_COLUMN[targetType]]: targetId,
      targetExcerpt: target.excerpt,
      reportedAuthorId: target.authorId,
      category,
      reason,
    })
    .onConflict((conflict) =>
      conflict
        .columns([
          "reporterId",
          "category",
          "reportedWritingGroupId",
          "reportedWritingThreadId",
          "reportedWritingPostId",
          "reportedWritingPageId",
          "reportedStoryIdeaId",
          "reportedChatGroupId",
          "reportedChatMessageId",
          "reportedUserId",
        ])
        .where("closedAt", "is", null)
        .where("reporterId", "is not", null)
        .where((eb) =>
          eb(
            eb.fn<number>("num_nonnulls", [
              "reportedWritingGroupId",
              "reportedWritingThreadId",
              "reportedWritingPostId",
              "reportedWritingPageId",
              "reportedStoryIdeaId",
              "reportedChatGroupId",
              "reportedChatMessageId",
              "reportedUserId",
            ]),
            "=",
            1,
          )
        )
        // The reason alone. The category cannot be rewritten because it is part of the key — a
        // different one is a different report — which is also what keeps this from overwriting a
        // report an operator is already holding with something about another subject entirely.
        // `target_excerpt` stays as it was first reported, so an author who edits what was
        // reported cannot overwrite the evidence through somebody else's re-report.
        .doUpdateSet({ reason })
    )
    .execute();

  return undefined;
}

/**
 * Whether the thing a report names is still there. It needs no query of its own: the target
 * columns are SET NULL, so a report whose column has emptied is one whose target is gone. That
 * is the difference between "go and look" and "already handled by somebody, or by its author".
 */
const TARGET_STILL_EXISTS = Object.values(TARGET_COLUMN);

/** What the queue shows, which is the row plus who filed it and whether the target is still there. */
export type Report = {
  id: string;
  targetType: ReportTargetType;
  targetExcerpt: string;
  category: ReportCategory;
  reason: string;
  status: ReportStatus;
  createdAt: string;
  // The lifecycle, as the two moments it consists of plus what was decided. `status` is derived
  // from the timestamps by the database, so it cannot disagree with them.
  inProgressAt: string | null;
  closedAt: string | null;
  closingOutcome: ReportOutcome | null;
  closingNote: string | null;
  // Whoever is dealing with it, which on a closed report is whoever closed it. Null for a report
  // nobody has taken, and also for one whose operator has since deleted their account.
  operatorUsername: string | null;
  reporterUsername: string | null;
  authorId: string | null;
  authorUsername: string | null;
  targetExists: boolean;
};

export type ReportFilters = {
  status?: ReportStatus;
  category?: ReportCategory;
  targetType?: ReportTargetType;
  closingOutcome?: ReportOutcome;
};

function listReports(
  query: ListQuery & ReportFilters,
): Promise<ListResults<Report>> {
  return listResultsWithCount(
    db
      .selectFrom("report")
      // Left, because a reporter who has since deleted their account leaves the report behind.
      .leftJoin("user", "user.id", "report.reporterId")
      .select((eb) => [
        "report.id",
        "report.targetType",
        "report.targetExcerpt",
        "report.category",
        "report.reason",
        "report.status",
        "report.createdAt",
        "report.inProgressAt",
        "report.closedAt",
        "report.closingOutcome",
        "report.closingNote",
        "user.username as reporterUsername",
        // The operator's name, by subselect for the reason the author's below is one: an aliased
        // join widens the builder's type past what `listResultsWithCount` accepts.
        eb
          .selectFrom("user as operator")
          .select("operator.username")
          .whereRef("operator.id", "=", "report.operatorId")
          .as("operatorUsername"),
        // Who to act on, which survives the reported thing being deleted. A subselect rather
        // than a second join to `user`: an aliased join widens the builder's type past what
        // `listResultsWithCount` accepts, and one row by primary key costs nothing.
        "report.reportedAuthorId as authorId",
        eb
          .selectFrom("user as author")
          .select("author.username")
          .whereRef("author.id", "=", "report.reportedAuthorId")
          .as("authorUsername"),
        // `$castTo`, not `cast`: the `$` marks a TypeScript-only narrowing that leaves the SQL
        // alone, which is right because `num_nonnulls(...) = 1` already *is* a boolean in
        // Postgres — the function returns integer, the comparison returns boolean. Kysely types
        // a comparison as `SqlBool` (`boolean | 0 | 1`) because MySQL and SQLite answer 0/1;
        // here it is a real boolean and only the type needs correcting. A `cast` would wrap
        // CAST(… AS boolean) around something already boolean.
        eb(eb.fn<number>("num_nonnulls", TARGET_STILL_EXISTS), "=", 1)
          .$castTo<boolean>()
          .as("targetExists"),
      ])
      .$if(query.status !== undefined, (builder) =>
        // deno-lint-ignore no-non-null-assertion -- the `$if` only runs this when it is set
        builder.where("report.status", "=", query.status!))
      .$if(query.category !== undefined, (builder) =>
        // deno-lint-ignore no-non-null-assertion -- as above
        builder.where("report.category", "=", query.category!))
      .$if(query.targetType !== undefined, (builder) =>
        // deno-lint-ignore no-non-null-assertion -- as above
        builder.where("report.targetType", "=", query.targetType!))
      .$if(query.closingOutcome !== undefined, (builder) =>
        // deno-lint-ignore no-non-null-assertion -- as above
        builder.where("report.closingOutcome", "=", query.closingOutcome!)),
    query,
  );
}

/**
 * Where an operator is moving a report. There are only two moves, because there is no reopening:
 * taking one, and closing it with what was decided.
 */
export type ReportMove =
  | { toStatus: "in_progress" }
  | { toStatus: "closed"; outcome: ReportOutcome; note: string };

export type ReportMoveRefusal =
  | "not_found"
  | "already_closed"
  | "held_by_another";

/**
 * Moves a report and records the move in the same statement, because the record *is* the row: the
 * lifecycle only goes forward, so nothing a move writes is ever overwritten and the report itself
 * is the account of what happened to it. That is what a second table was for while reopening
 * existed.
 *
 * Both moves are one `UPDATE` whose `WHERE` carries the whole rule, so two operators arriving
 * together resolve to one winner rather than both passing a check and then both writing.
 */
async function moveReport(
  reportId: string,
  move: ReportMove,
  operatorId: string,
): Promise<ReportMoveRefusal | undefined> {
  const now = Temporal.Now.instant().toString();

  const moved = await db
    .updateTable("report")
    .set(
      move.toStatus === "in_progress"
        // Taking a report already taken is deliberately allowed, and overwrites the holder: the
        // state says "somebody has this", and a lock nobody can pick strands a report the day its
        // holder stops reading the queue. The cost is that only the last holder is recorded.
        ? { operatorId, inProgressAt: now }
        // Closing from `open` never sets `in_progress_at`, which is honest — nobody took it — and
        // it still records who closed it, because `operator_id` is set either way.
        : {
          operatorId,
          closedAt: now,
          closingOutcome: move.outcome,
          closingNote: move.note,
        },
    )
    .where("id", "=", reportId)
    // Nothing moves a closed report. This is where reopening would have gone.
    .where("closedAt", "is", null)
    .$if(move.toStatus === "closed", (builder) =>
      // Only whoever holds it may close it, so two operators cannot both judge one case — or
      // anybody, once that account is gone, which is the whole of the escape hatch.
      builder.where((eb) =>
        eb.or([
          eb("operatorId", "is", null),
          eb("operatorId", "=", operatorId),
        ])
      ))
    .returning("id")
    .executeTakeFirst();

  if (moved !== undefined) {
    return undefined;
  }

  // Only to say *why*. The statement above is the arbiter; this read can be a moment stale under
  // a race, which costs a slightly wrong sentence and never a wrong outcome.
  const report = await db
    .selectFrom("report")
    .select(["closedAt"])
    .where("id", "=", reportId)
    .executeTakeFirst();

  if (report === undefined) {
    return "not_found";
  }

  return report.closedAt === null ? "held_by_another" : "already_closed";
}

export const ReportService = { insertReport, listReports, moveReport };
