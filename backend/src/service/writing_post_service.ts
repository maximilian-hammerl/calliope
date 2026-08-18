import { type Selectable, sql } from "kysely";
import { db } from "@/src/database/client.ts";
import type { WritingPost as DatabaseWritingPost } from "@/src/database/schema.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
  searchPattern,
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
    | "editedAt"
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
  "writingPost.editedAt",
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
  query: ListQuery & { isDraft: boolean },
): Promise<ListResults<Post>> {
  return listResultsWithCount(
    postsWithAuthor(viewerId)
      .where("writingPost.writingThreadId", "=", threadId)
      .where("writingPost.isDraft", "=", query.isDraft)
      // The body rather than a title: a post has none.
      .$if(query.search !== undefined, (queryBuilder) =>
        queryBuilder.where(
          "writingPost.text",
          "ilike",
          searchPattern(query.search!),
        )),
    query,
  );
}

/** Returns nothing when there is no such post. Authorisation is the caller's job. */
/**
 * `wasDraft` is the row's state before this change, which is what separates the three ways a
 * post can be written to: autosaving a draft, publishing one, and editing what is already
 * published. Only the last is an edit a reader is told about.
 */
async function updatePost(
  postId: string,
  changes: { text?: string; isDraft?: boolean },
  wasDraft: boolean,
): Promise<Post | undefined> {
  const isPublishing = wasDraft && changes.isDraft === false;
  const isEditingPublished = !wasDraft && changes.text !== undefined;

  const updated = await db
    .updateTable("writingPost")
    .set({
      ...changes,
      // A post is born when it is published, not when its draft was first autosaved: a piece
      // drafted over three days would otherwise appear dated three days ago and sort into the
      // middle of the thread it belongs at the end of.
      ...(isPublishing ? { createdAt: sql<string>`now()` } : {}),
      ...(isEditingPublished ? { editedAt: sql<string>`now()` } : {}),
    })
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
