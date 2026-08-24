import { db } from "@/src/database/client.ts";
import type { ReportTargetType } from "@/src/database/schema.ts";
import type { User } from "@/src/service/user_service.ts";
import { UserService } from "@/src/service/user_service.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { ChatGroupService } from "@/src/service/chat_group_service.ts";
import { StoryIdeaService } from "@/src/service/story_idea_service.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";

/**
 * Whether a member may see one of the things this platform lets them act on, and what it says.
 *
 * Two features ask: reporting, which needs the excerpt as well, and favouriting, which needs only
 * the answer. Both must ask, because either one answering differently for a thing that exists and
 * a thing the member cannot see would turn it into a way of discovering private writing.
 *
 * Typed over `ReportTargetType` because that is the widest set — `FavouriteTargetType`'s five
 * values are a subset of these seven, so a favourite's type is assignable without a cast.
 *
 * Threads, posts and chat messages are reached through the thing that governs them rather than
 * checked here: the group's visibility rule and the chat's membership rule live in one place
 * each, and a second copy of either is how a private group's writing became readable once
 * already.
 */
export type VisibleTarget = { authorId: string | null };

/** With what it said, which only reporting needs — see `withExcerpt` below. */
export type VisibleTargetWithExcerpt = VisibleTarget & { excerpt: string };

/**
 * Long enough to judge a short post or message, short enough that a report does not become a
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

/**
 * `undefined` when the member may not see it, which every caller answers as 404 so that asking
 * cannot confirm something exists.
 */
/**
 * **The excerpt is opt-in, because one kind of it is expensive.** A post's body runs to a hundred
 * thousand characters, which Postgres stores out of line, so selecting it costs a detoast and the
 * whole string over the wire — measured at about 0.1ms server-side per call plus the transfer,
 * against 500 reads. Reporting needs it and asks; favouriting only needs the answer and does not,
 * and favouriting is the one people do freely.
 *
 * One dispatch either way. Two functions would mean two copies of five visibility rules, which is
 * the thing this module exists to prevent — so what varies is a column in one branch, not a rule.
 */
export function resolveVisibleTarget(
  user: User,
  targetType: ReportTargetType,
  targetId: string,
): Promise<VisibleTarget | undefined>;

export function resolveVisibleTarget(
  user: User,
  targetType: ReportTargetType,
  targetId: string,
  options: { withExcerpt: true },
): Promise<VisibleTargetWithExcerpt | undefined>;

export async function resolveVisibleTarget(
  user: User,
  targetType: ReportTargetType,
  targetId: string,
  options: { withExcerpt?: boolean } = {},
): Promise<VisibleTargetWithExcerpt | undefined> {
  const withExcerpt = options.withExcerpt ?? false;

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
          "writingPost.isDraft",
          "writingPost.createdBy",
          "writingThread.writingGroupId",
        ])
        // Only when somebody asked. This is the column the opt-in exists for.
        .$if(
          withExcerpt,
          (queryBuilder) => queryBuilder.select("writingPost.text"),
        )
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
        : { excerpt: excerpt(post.text ?? ""), authorId: post.createdBy };
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
