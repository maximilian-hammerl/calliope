import { db } from "@/src/database/client.ts";
import type {
  ReportCategory,
  ReportStatus,
  ReportTargetType,
} from "@/src/database/schema.ts";
import type { ListQuery, ListResults } from "@/src/list/list_endpoint_query.ts";
import { listResultsWithCount } from "@/src/list/list_endpoint_query.ts";
import type { User } from "@/src/service/user_service.ts";
import { UserService } from "@/src/service/user_service.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { ChatGroupService } from "@/src/service/chat_group_service.ts";
import { StoryIdeaService } from "@/src/service/story_idea_service.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";

/**
 * What a member has reported to the operators.
 *
 * Two rules run through all of it. **You can only report what you can see** — every kind is
 * resolved through the same check that guards reading it, so a report cannot be used to find out
 * whether something exists. And **the excerpt is written here, never sent by the client**: a
 * snapshot composed by the person filing the report would be evidence they wrote themselves.
 */

/**
 * Long enough to judge a short post or message, short enough that the table does not become a
 * second copy of the writing. Not in `text_limit.ts`: that file bounds what a member types, and
 * nobody types this.
 */
const EXCERPT_LENGTH = 2_000;

function excerpt(text: string): string {
  const collapsed = text.trim();
  return collapsed.length <= EXCERPT_LENGTH
    ? collapsed
    : `${collapsed.slice(0, EXCERPT_LENGTH - 1).trimEnd()}…`;
}

/** The column the target's id goes in, which `report_target_matches_type` also enforces. */
const TARGET_COLUMN = {
  writing_group: "reportedWritingGroupId",
  writing_thread: "reportedWritingThreadId",
  writing_post: "reportedWritingPostId",
  story_idea: "reportedStoryIdeaId",
  chat_group: "reportedChatGroupId",
  chat_message: "reportedChatMessageId",
  user: "reportedUserId",
} as const satisfies Record<ReportTargetType, string>;

/**
 * Resolves the target through the reader's own visibility and returns what it said, or
 * `undefined` when they may not see it — which the route answers as 404, so reporting cannot
 * confirm that something exists.
 *
 * Threads, posts and chat messages are reached through the thing that governs them rather than
 * checked here: the group's visibility rule and the chat's membership rule live in one place
 * each, and a second copy of either is how a private group's writing became readable once
 * already.
 */
type ResolvedTarget = { excerpt: string; authorId: string | null };

async function resolveTarget(
  user: User,
  targetType: ReportTargetType,
  targetId: string,
): Promise<ResolvedTarget | undefined> {
  switch (targetType) {
    case "writing_group": {
      const group = await WritingGroupService.selectVisibleWritingGroup(
        user,
        targetId,
      );
      return group === undefined
        ? undefined
        : { excerpt: excerpt(group.title), authorId: group.createdBy };
    }

    case "writing_thread": {
      const thread = await db
        .selectFrom("writingThread")
        .select(["title", "writingGroupId", "createdBy"])
        .where("id", "=", targetId)
        .executeTakeFirst();

      if (thread === undefined) {
        return undefined;
      }

      const group = await WritingGroupService.selectVisibleWritingGroup(
        user,
        thread.writingGroupId,
      );
      return group === undefined
        ? undefined
        : { excerpt: excerpt(thread.title), authorId: thread.createdBy };
    }

    case "writing_post": {
      const post = await db
        .selectFrom("writingPost")
        .innerJoin(
          "writingThread",
          "writingThread.id",
          "writingPost.writingThreadId",
        )
        .select([
          "writingPost.text",
          "writingPost.isDraft",
          "writingPost.createdBy",
          "writingThread.writingGroupId",
        ])
        .where("writingPost.id", "=", targetId)
        .executeTakeFirst();

      // A draft is visible only to its author, and reporting your own draft is not a thing.
      if (post === undefined || (post.isDraft && post.createdBy !== user.id)) {
        return undefined;
      }

      const group = await WritingGroupService.selectVisibleWritingGroup(
        user,
        post.writingGroupId,
      );
      return group === undefined
        ? undefined
        : { excerpt: excerpt(post.text), authorId: post.createdBy };
    }

    case "story_idea": {
      const idea = await StoryIdeaService.selectStoryIdea(targetId, user.id);
      return idea === undefined
        ? undefined
        : { excerpt: excerpt(idea.title), authorId: idea.createdBy };
    }

    case "chat_group": {
      const chat = await ChatGroupService.selectChatGroup(user, targetId);
      return chat === undefined
        ? undefined
        : { excerpt: excerpt(chat.title ?? ""), authorId: chat.createdBy };
    }

    case "chat_message": {
      const message = await db
        .selectFrom("chatMessage")
        .select(["text", "chatGroupId", "createdBy"])
        .where("id", "=", targetId)
        .executeTakeFirst();

      if (message === undefined) {
        return undefined;
      }

      const chat = await ChatGroupService.selectChatGroup(
        user,
        message.chatGroupId,
      );
      return chat === undefined
        ? undefined
        : { excerpt: excerpt(message.text), authorId: message.createdBy };
    }

    case "user": {
      const profile = await UserService.selectUserProfile(targetId);
      // The reported account answers for itself.
      return profile === undefined
        ? undefined
        : { excerpt: excerpt(profile.username), authorId: profile.id };
    }

    default:
      return assertUnreachable(targetType);
  }
}

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

  const target = await resolveTarget(user, targetType, targetId);

  if (target === undefined) {
    return "not_found";
  }

  // Once here rather than per target type: every branch resolves an author, and the interface
  // already hides the action on one's own writing.
  if (target.authorId !== null && target.authorId === user.id) {
    return "own_content";
  }

  // Reporting the same thing again rewrites the reason rather than being refused: half a
  // sentence submitted by a stray Enter is the likely way it happens, and saying it again is
  // the member's only way to fix it.
  //
  // One statement, so two reports racing cannot both insert. The ON CONFLICT clause has to
  // restate the index's own predicate because that index is partial — without it Postgres
  // answers "no unique or exclusion constraint matching the ON CONFLICT specification". It is
  // spelled through `eb.fn` rather than a raw `sql` template so the column names stay checked.
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
          "reportedWritingGroupId",
          "reportedWritingThreadId",
          "reportedWritingPostId",
          "reportedStoryIdeaId",
          "reportedChatGroupId",
          "reportedChatMessageId",
          "reportedUserId",
        ])
        .where("status", "=", "open")
        .where("reporterId", "is not", null)
        .where((eb) =>
          eb(
            eb.fn<number>("num_nonnulls", [
              "reportedWritingGroupId",
              "reportedWritingThreadId",
              "reportedWritingPostId",
              "reportedStoryIdeaId",
              "reportedChatGroupId",
              "reportedChatMessageId",
              "reportedUserId",
            ]),
            "=",
            1,
          )
        )
        // The category too: somebody correcting a half-typed reason may well have picked the
        // wrong category in the same hurry. `target_excerpt` stays as it was first reported, so
        // an author who edits what was reported cannot overwrite the evidence through somebody
        // else's re-report.
        .doUpdateSet({ category, reason })
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
  closedAt: string | null;
  reporterUsername: string | null;
  authorId: string | null;
  authorUsername: string | null;
  targetExists: boolean;
};

export type ReportFilters = {
  status?: ReportStatus;
  category?: ReportCategory;
  targetType?: ReportTargetType;
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
        "report.closedAt",
        "user.username as reporterUsername",
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
        builder.where("report.targetType", "=", query.targetType!)),
    query,
  );
}

/**
 * Closing a report records who did it and when, which is the only account of what was done —
 * nothing else in the product keeps one yet.
 */
async function closeReport(
  reportId: string,
  status: Exclude<ReportStatus, "open">,
  operatorId: string,
): Promise<"not_found" | undefined> {
  const closed = await db
    .updateTable("report")
    .set({
      status,
      closedAt: Temporal.Now.instant().toString(),
      closedBy: operatorId,
    })
    .where("id", "=", reportId)
    // Only an open one closes: reopening, or overwriting who closed it, is a different act and
    // not one this offers.
    .where("status", "=", "open")
    .returning("id")
    .executeTakeFirst();

  return closed === undefined ? "not_found" : undefined;
}

export const ReportService = { insertReport, listReports, closeReport };
