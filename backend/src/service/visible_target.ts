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
 * Reporting and favouriting both ask, because either answering differently for a thing that exists
 * and a thing the member cannot see would turn it into a way of discovering private writing.
 *
 * Typed over `ReportTargetType`, the wider set, so a favourite's five values are assignable.
 * Threads, posts and messages are reached through whatever governs them, so the group's visibility
 * rule and the chat's membership rule each stay in one place.
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
 * `undefined` when the member may not see it, which every caller answers as 404.
 *
 * The excerpt is opt-in because a post's body is TOASTed: selecting it costs a detoast and the
 * whole string over the wire, and favouriting needs only the answer.
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
): Promise<(VisibleTarget & { excerpt?: string }) | undefined> {
  const withExcerpt = options.withExcerpt ?? false;

  /**
   * No `excerpt` key at all when nobody asked for one. Returning `excerpt: ""` typed it away behind
   * the overload while leaving an empty string on the object — which reads as "it said nothing"
   * to anything that logs or serialises the result.
   */
  const seen = (authorId: string | null, text: () => string) =>
    withExcerpt ? { authorId, excerpt: excerpt(text()) } : { authorId };

  switch (targetType) {
    case "writing_group": {
      const group = await WritingGroupService.selectVisibleWritingGroup(
        user,
        targetId,
      );
      return group === undefined
        ? undefined
        : seen(group.createdBy, () => group.title);
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
        : seen(thread.createdBy, () => thread.title);
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
        : seen(post.createdBy, () => post.text ?? "");
    }

    case "story_idea": {
      const idea = await StoryIdeaService.selectStoryIdeaGate(targetId);
      return idea === undefined
        ? undefined
        : seen(idea.createdBy, () => idea.title);
    }

    case "chat_group": {
      const chat = await ChatGroupService.selectChatGroup(user, targetId);
      return chat === undefined
        ? undefined
        : seen(chat.createdBy, () => chat.title ?? "");
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
        : seen(message.createdBy, () => message.text);
    }

    case "user": {
      const profile = await UserService.selectUserProfile(targetId);
      // The reported account answers for itself.
      return profile === undefined
        ? undefined
        : seen(profile.id, () => profile.username);
    }

    default:
      return assertUnreachable(targetType);
  }
}
