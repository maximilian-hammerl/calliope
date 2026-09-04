import { db } from "@/src/database/client.ts";
import type {
  ForumPermission,
  ReportTargetType,
} from "@/src/database/schema.ts";
import type { User } from "@/src/service/user_service.ts";
import { UserService } from "@/src/service/user_service.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { ChatGroupService } from "@/src/service/chat_group_service.ts";
import { StoryIdeaService } from "@/src/service/story_idea_service.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";
import { mayReadForumContent } from "@/src/service/forum_permission.ts";

/**
 * Whether a member may see one of the things this platform lets them act on, and what it says.
 * Reporting and favouriting both ask, because either answering differently for a thing that exists
 * and a thing the member cannot see would turn it into a way of discovering private writing.
 *
 * Typed over `ReportTargetType`, the wider set, so a favourite's six values are assignable.
 * Threads, posts and messages are reached through whatever governs them, so the group's visibility
 * rule, the forum's permission and the chat's membership rule each stay in one place.
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
 * The two scopes the tables shared with the public forum carry (#32). A group row is visible when
 * its group is; a forum row when its permission is not `hidden`, which is why hidden answers 404
 * like everything else here. A null `writingGroupId` is what tells the two apart, and the CHECK on
 * each table is what guarantees the permission is there when it is.
 */
async function inScope(
  user: User,
  row: {
    writingGroupId: string | null;
    memberPermission: ForumPermission | null;
    effectiveMemberPermission: ForumPermission | null;
  },
): Promise<boolean> {
  if (row.writingGroupId !== null) {
    return await WritingGroupService.selectVisibleWritingGroup(
      user,
      row.writingGroupId,
    ) !== undefined;
  }

  // The CHECK makes the fallback unreachable; it is here so the failure is closed rather than open.
  return mayReadForumContent(
    user,
    row.memberPermission ?? "hidden",
    row.effectiveMemberPermission,
  );
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
        .leftJoin("writingFolder", "writingFolder.id", "writingThread.folderId")
        .select([
          "writingThread.title",
          "writingThread.writingGroupId",
          "writingThread.createdBy",
          "writingThread.memberPermission",
          "writingFolder.effectiveMemberPermission",
        ])
        .where("writingThread.id", "=", targetId)
        .executeTakeFirst();

      if (thread === undefined) {
        return undefined;
      }

      return await inScope(user, thread)
        ? seen(thread.createdBy, () => thread.title)
        : undefined;
    }

    case "writing_page": {
      const page = await db
        .selectFrom("writingPage")
        .leftJoin("writingFolder", "writingFolder.id", "writingPage.folderId")
        .select([
          "writingPage.writingGroupId",
          "writingPage.createdBy",
          "writingPage.memberPermission",
          "writingFolder.effectiveMemberPermission",
        ])
        // The prose, not the title: a page has a body, so an operator reading the queue after
        // it is deleted needs what it said. Only when somebody asked, as a post's is.
        .$if(
          withExcerpt,
          (queryBuilder) => queryBuilder.select("writingPage.text"),
        )
        .where("writingPage.id", "=", targetId)
        .executeTakeFirst();

      if (page === undefined) {
        return undefined;
      }

      return await inScope(user, page)
        ? seen(page.createdBy, () => page.text ?? "")
        : undefined;
    }

    case "writing_post": {
      const post = await db
        .selectFrom("writingPost")
        .innerJoin(
          "writingThread",
          "writingThread.id",
          "writingPost.writingThreadId",
        )
        .leftJoin("writingFolder", "writingFolder.id", "writingThread.folderId")
        .select([
          "writingPost.isDraft",
          "writingPost.createdBy",
          "writingThread.writingGroupId",
          // The thread's, not the post's: a post is not placed in the tree, so what governs it
          // is whatever governs the thread it is in.
          "writingThread.memberPermission",
          "writingFolder.effectiveMemberPermission",
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

      return await inScope(user, post)
        ? seen(post.createdBy, () => post.text ?? "")
        : undefined;
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
