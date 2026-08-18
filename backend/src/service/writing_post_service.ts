import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type { WritingPost as DatabaseWritingPost } from "@/src/database/schema.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
} from "@/src/list_endpoint_query.ts";

export type Post =
  & Pick<
    Selectable<DatabaseWritingPost>,
    | "id"
    | "writingThreadId"
    | "text"
    | "isDraft"
    | "createdBy"
    | "createdAt"
    | "updatedAt"
  >
  // Null once the author has deleted their account, because created_by is ON DELETE SET NULL.
  & { createdByUsername: string | null };

const SELECTED_COLUMNS = [
  "writingPost.id",
  "writingPost.writingThreadId",
  "writingPost.text",
  "writingPost.isDraft",
  "writingPost.createdBy",
  "writingPost.createdAt",
  "writingPost.updatedAt",
] as const;

/** Reads one post back with its author, bypassing the draft filter: after a write the
 * caller has already established that it may see the row. */
function postWithAuthorById(postId: string) {
  return db
    .selectFrom("writingPost")
    .leftJoin("user", "user.id", "writingPost.createdBy")
    .select([...SELECTED_COLUMNS, "user.username as createdByUsername"])
    .where("writingPost.id", "=", postId);
}

async function insertPost(
  threadId: string,
  text: string,
  isDraft: boolean,
  createdBy: string,
): Promise<Post> {
  const { id } = await db
    .insertInto("writingPost")
    .values({ writingThreadId: threadId, text, isDraft, createdBy })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  // Re-read rather than RETURNING, which cannot reach the joined author name.
  return await postWithAuthorById(id).executeTakeFirstOrThrow();
}

/**
 * A draft is written before publishing, so it belongs to its author alone until it is
 * published. Everything else in the thread is readable by any member.
 */
function readableBy(viewerId: string) {
  return db
    .selectFrom("writingPost")
    .where((eb) =>
      eb.or([
        eb("writingPost.isDraft", "=", false),
        eb("writingPost.createdBy", "=", viewerId),
      ])
    );
}

/**
 * The author's name is joined in rather than stored, so it follows a rename. The join is
 * left: an account that has been deleted leaves the post behind with no author.
 */
function postsWithAuthor(viewerId: string) {
  return readableBy(viewerId)
    .leftJoin("user", "user.id", "writingPost.createdBy")
    .select([...SELECTED_COLUMNS, "user.username as createdByUsername"]);
}

/** Scoped to the thread, so a post id from another thread cannot be reached through it. */
async function selectPost(
  threadId: string,
  postId: string,
  viewerId: string,
): Promise<Post | undefined> {
  return await postsWithAuthor(viewerId)
    .where("writingPost.writingThreadId", "=", threadId)
    .where("writingPost.id", "=", postId)
    .executeTakeFirst();
}

function listPosts(
  threadId: string,
  viewerId: string,
  query: ListQuery,
): Promise<ListResults<Post>> {
  return listResultsWithCount(
    postsWithAuthor(viewerId).where(
      "writingPost.writingThreadId",
      "=",
      threadId,
    ),
    query,
  );
}

/** Returns nothing when there is no such post. Authorisation is the caller's job. */
async function updatePost(
  postId: string,
  changes: { text?: string; isDraft?: boolean },
): Promise<Post | undefined> {
  const updated = await db
    .updateTable("writingPost")
    .set(changes)
    .where("id", "=", postId)
    .returning(["id"])
    .executeTakeFirst();

  if (updated === undefined) {
    return undefined;
  }

  return await postWithAuthorById(updated.id).executeTakeFirstOrThrow();
}

async function deletePost(postId: string): Promise<boolean> {
  const deletion = await db
    .deleteFrom("writingPost")
    .where("id", "=", postId)
    .executeTakeFirst();

  return deletion.numDeletedRows > 0n;
}

export const WritingPostService = {
  insertPost,
  selectPost,
  listPosts,
  updatePost,
  deletePost,
};
