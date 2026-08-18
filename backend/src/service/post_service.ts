import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type { Post as DatabasePost } from "@/src/database/schema.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
} from "@/src/list_endpoint_query.ts";

export type Post =
  & Pick<
    Selectable<DatabasePost>,
    | "id"
    | "threadId"
    | "text"
    | "isDraft"
    | "createdBy"
    | "createdAt"
    | "updatedAt"
  >
  // Null once the author has deleted their account, because created_by is ON DELETE SET NULL.
  & { createdByUsername: string | null };

const SELECTED_COLUMNS = [
  "post.id",
  "post.threadId",
  "post.text",
  "post.isDraft",
  "post.createdBy",
  "post.createdAt",
  "post.updatedAt",
] as const;

/** Reads one post back with its author, bypassing the draft filter: after a write the
 * caller has already established that it may see the row. */
function postWithAuthorById(postId: string) {
  return db
    .selectFrom("post")
    .leftJoin("user", "user.id", "post.createdBy")
    .select([...SELECTED_COLUMNS, "user.username as createdByUsername"])
    .where("post.id", "=", postId);
}

async function insertPost(
  threadId: string,
  text: string,
  isDraft: boolean,
  createdBy: string,
): Promise<Post> {
  const { id } = await db
    .insertInto("post")
    .values({ threadId, text, isDraft, createdBy })
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
    .selectFrom("post")
    .where((eb) =>
      eb.or([
        eb("post.isDraft", "=", false),
        eb("post.createdBy", "=", viewerId),
      ])
    );
}

/**
 * The author's name is joined in rather than stored, so it follows a rename. The join is
 * left: an account that has been deleted leaves the post behind with no author.
 */
function postsWithAuthor(viewerId: string) {
  return readableBy(viewerId)
    .leftJoin("user", "user.id", "post.createdBy")
    .select([...SELECTED_COLUMNS, "user.username as createdByUsername"]);
}

/** Scoped to the thread, so a post id from another thread cannot be reached through it. */
async function selectPost(
  threadId: string,
  postId: string,
  viewerId: string,
): Promise<Post | undefined> {
  return await postsWithAuthor(viewerId)
    .where("post.threadId", "=", threadId)
    .where("post.id", "=", postId)
    .executeTakeFirst();
}

function listPosts(
  threadId: string,
  viewerId: string,
  query: ListQuery,
): Promise<ListResults<Post>> {
  return listResultsWithCount(
    postsWithAuthor(viewerId).where("post.threadId", "=", threadId),
    query,
  );
}

/** Returns nothing when there is no such post. Authorisation is the caller's job. */
async function updatePost(
  postId: string,
  changes: { text?: string; isDraft?: boolean },
): Promise<Post | undefined> {
  const updated = await db
    .updateTable("post")
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
    .deleteFrom("post")
    .where("id", "=", postId)
    .executeTakeFirst();

  return deletion.numDeletedRows > 0n;
}

export const PostService = {
  insertPost,
  selectPost,
  listPosts,
  updatePost,
  deletePost,
};
