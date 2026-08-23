import type { Selectable } from "kysely";
import { db, type Transaction } from "@/src/database/client.ts";
import { NotificationService } from "@/src/service/notification_service.ts";
import type { WritingPost as DatabaseWritingPost } from "@/src/database/schema.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
  searchPattern,
} from "@/src/list/list_endpoint_query.ts";

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
    | "editedBy"
  >
  // Both null once that account is deleted, because the columns are ON DELETE SET NULL.
  & { createdByUsername: string | null; editedByUsername: string | null };

const SELECTED_COLUMNS = [
  "writingPost.id",
  "writingPost.writingThreadId",
  "writingPost.text",
  "writingPost.isDraft",
  "writingPost.createdBy",
  "writingPost.createdAt",
  "writingPost.editedAt",
  "writingPost.editedBy",
] as const;

/** Reads one post back with its author, bypassing the draft filter: after a write the
 * caller has already established that it may see the row. */
function postWithAuthorById(
  postId: string,
  executor: typeof db | Transaction = db,
) {
  return executor
    .selectFrom("writingPost")
    .leftJoin("user", "user.id", "writingPost.createdBy")
    .select([
      ...SELECTED_COLUMNS,
      "user.username as createdByUsername",
      // A subquery rather than a second join on `user`: an alias widens the builder's table
      // set past what `listResultsWithCount` accepts, and this is a primary-key lookup.
      (eb) =>
        eb.selectFrom("user as editor")
          .select("editor.username")
          .whereRef("editor.id", "=", "writingPost.editedBy")
          .as("editedByUsername"),
    ])
    .where("writingPost.id", "=", postId);
}

async function insertPost(
  writingGroupId: string,
  threadId: string,
  text: string,
  isDraft: boolean,
  createdBy: string,
): Promise<Post> {
  return await db.transaction().execute(async (transaction) => {
    const { id } = await transaction
      .insertInto("writingPost")
      .values({ writingThreadId: threadId, text, isDraft, createdBy })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    // A draft is visible to nobody but its author, so there is nothing yet to announce. The
    // telling happens when it is published, which is an update rather than an insert.
    if (!isDraft) {
      await NotificationService.insertGroupActivityNotifications(transaction, {
        type: "new_writing_post",
        writingGroupId,
        writingThreadId: threadId,
        writingPostId: id,
        actorId: createdBy,
      });
    }

    // Re-read rather than RETURNING, which cannot reach the joined author name.
    return await postWithAuthorById(id, transaction).executeTakeFirstOrThrow();
  });
}

/**
 * A draft is written before publishing, so it belongs to its author alone until it is
 * published. Everything else in the thread is readable by any member.
 */
function readableBy(viewerId: string, executor: typeof db | Transaction = db) {
  return executor
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
function postsWithAuthor(
  viewerId: string,
  executor: typeof db | Transaction = db,
) {
  return readableBy(viewerId, executor)
    .leftJoin("user", "user.id", "writingPost.createdBy")
    .select([
      ...SELECTED_COLUMNS,
      "user.username as createdByUsername",
      // A subquery rather than a second join on `user`: an alias widens the builder's table
      // set past what `listResultsWithCount` accepts, and this is a primary-key lookup.
      (eb) =>
        eb.selectFrom("user as editor")
          .select("editor.username")
          .whereRef("editor.id", "=", "writingPost.editedBy")
          .as("editedByUsername"),
    ]);
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
          // deno-lint-ignore no-non-null-assertion -- the `$if` above only runs this when the term is set
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
/**
 * `wasDraft` is the row's state before this change, which is what separates the three ways a
 * post can be written to: autosaving a draft, publishing one, and editing what is already
 * published.
 */
async function updatePost(
  postId: string,
  changes: { text?: string; isDraft?: boolean },
  wasDraft: boolean,
  context: { writingGroupId: string; writingThreadId: string; actorId: string },
): Promise<Post | undefined> {
  const isPublishing = wasDraft && changes.isDraft === false;
  const isEditingPublished = !wasDraft && changes.text !== undefined;

  return await db.transaction().execute(async (transaction) => {
    const updated = await transaction
      .updateTable("writingPost")
      .set({
        ...changes,
        // A post is born when it is published, not when its draft was first autosaved: a
        // piece drafted over three days would otherwise appear dated three days ago and sort
        // into the middle of the thread it belongs at the end of.
        ...(isPublishing
          ? { createdAt: Temporal.Now.instant().toString() }
          : {}),
        // Who, not only when: `mayModify` lets somebody administering the group edit another
        // member's post, and the reader is told which of the two happened.
        ...(isEditingPublished
          ? {
            editedAt: Temporal.Now.instant().toString(),
            editedBy: context.actorId,
          }
          : {}),
      })
      .where("id", "=", postId)
      .returning(["id"])
      .executeTakeFirst();

    if (updated === undefined) {
      return undefined;
    }

    // Publishing is the moment the writing becomes everybody's; editing it again is not.
    if (isPublishing) {
      await NotificationService.insertGroupActivityNotifications(transaction, {
        type: "new_writing_post",
        writingGroupId: context.writingGroupId,
        writingThreadId: context.writingThreadId,
        writingPostId: updated.id,
        actorId: context.actorId,
      });
    }

    return await postWithAuthorById(updated.id, transaction)
      .executeTakeFirstOrThrow();
  });
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
