import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type { Post as DatabasePost } from "@/src/database/schema.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
} from "@/src/list_endpoint_query.ts";

export type Post = Pick<
  Selectable<DatabasePost>,
  | "id"
  | "threadId"
  | "text"
  | "isDraft"
  | "createdBy"
  | "createdAt"
  | "updatedAt"
>;

const SELECTED_COLUMNS = [
  "post.id",
  "post.threadId",
  "post.text",
  "post.isDraft",
  "post.createdBy",
  "post.createdAt",
  "post.updatedAt",
] as const;

const RETURNED_COLUMNS = [
  "id",
  "threadId",
  "text",
  "isDraft",
  "createdBy",
  "createdAt",
  "updatedAt",
] as const;

function insertPost(
  threadId: string,
  text: string,
  isDraft: boolean,
  createdBy: string,
): Promise<Post> {
  return db
    .insertInto("post")
    .values({ threadId, text, isDraft, createdBy })
    .returning(RETURNED_COLUMNS)
    .executeTakeFirstOrThrow();
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

/** Scoped to the thread, so a post id from another thread cannot be reached through it. */
async function selectPost(
  threadId: string,
  postId: string,
  viewerId: string,
): Promise<Post | undefined> {
  return await readableBy(viewerId)
    .select(SELECTED_COLUMNS)
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
    readableBy(viewerId)
      .select(SELECTED_COLUMNS)
      .where("post.threadId", "=", threadId),
    query,
  );
}

/** Returns nothing when there is no such post. Authorisation is the caller's job. */
async function updatePost(
  postId: string,
  changes: { text?: string; isDraft?: boolean },
): Promise<Post | undefined> {
  return await db
    .updateTable("post")
    .set(changes)
    .where("id", "=", postId)
    .returning(RETURNED_COLUMNS)
    .executeTakeFirst();
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
