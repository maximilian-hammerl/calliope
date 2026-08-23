import { db } from "@/src/database/client.ts";
import type {
  ReportCategory,
  ReportTargetType,
} from "@/src/database/schema.ts";
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
const EXCERPT_LENGTH = 500;

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
async function resolveTarget(
  user: User,
  targetType: ReportTargetType,
  targetId: string,
): Promise<string | undefined> {
  switch (targetType) {
    case "writing_group": {
      const group = await WritingGroupService.selectVisibleWritingGroup(
        user,
        targetId,
      );
      return group === undefined ? undefined : excerpt(group.title);
    }

    case "writing_thread": {
      const thread = await db
        .selectFrom("writingThread")
        .select(["title", "writingGroupId"])
        .where("id", "=", targetId)
        .executeTakeFirst();

      if (thread === undefined) {
        return undefined;
      }

      const group = await WritingGroupService.selectVisibleWritingGroup(
        user,
        thread.writingGroupId,
      );
      return group === undefined ? undefined : excerpt(thread.title);
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
      return group === undefined ? undefined : excerpt(post.text);
    }

    case "story_idea": {
      const idea = await StoryIdeaService.selectStoryIdea(targetId, user.id);
      return idea === undefined ? undefined : excerpt(idea.title);
    }

    case "chat_group": {
      const chat = await ChatGroupService.selectChatGroup(user, targetId);
      return chat === undefined ? undefined : excerpt(chat.title ?? "");
    }

    case "chat_message": {
      const message = await db
        .selectFrom("chatMessage")
        .select(["text", "chatGroupId"])
        .where("id", "=", targetId)
        .executeTakeFirst();

      if (message === undefined) {
        return undefined;
      }

      const chat = await ChatGroupService.selectChatGroup(
        user,
        message.chatGroupId,
      );
      return chat === undefined ? undefined : excerpt(message.text);
    }

    case "user": {
      const profile = await UserService.selectUserProfile(targetId);
      return profile === undefined ? undefined : excerpt(profile.username);
    }

    default:
      return assertUnreachable(targetType);
  }
}

export type ReportRefusal = "not_found" | "own_account";

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

  const targetExcerpt = await resolveTarget(user, targetType, targetId);

  if (targetExcerpt === undefined) {
    return "not_found";
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
      targetExcerpt,
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

export const ReportService = { insertReport };
