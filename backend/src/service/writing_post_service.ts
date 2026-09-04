import type { Selectable } from "kysely";
import { db, type Transaction } from "@/src/database/client.ts";
import { NotificationService } from "@/src/service/notification_service.ts";
import type { WritingPost as DatabaseWritingPost } from "@/src/database/schema.ts";
import type { PostDocument } from "@/src/document/document_schema.ts";
import { documentToPlainText } from "@/src/document/document_text.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
  searchPattern,
} from "@/src/list/list_endpoint_query.ts";
import { type FavouriteFilter, withFavourite } from "@/src/query/favourite.ts";

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
  // Not picked from the table, where the column is `unknown` by design — see the `typeMapping`
  // note in `database/.kysely-codegenrc.ts`. This is the type that says what is in there.
  & { document: PostDocument }
  & {
    /** The reader's own favourite, visible to nobody else. */
    isFavourite: boolean;
  }
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
  viewerId: string,
  executor: typeof db | Transaction = db,
) {
  return executor
    .selectFrom("writingPost")
    .leftJoin("user", "user.id", "writingPost.createdBy")
    .$call((builder) =>
      withFavourite(builder, "writing_post", "writingPost.id", viewerId)
    )
    .select((eb) => [
      ...SELECTED_COLUMNS,
      // Cast rather than selected plainly: the column's generated type is `unknown`, and
      // `DOCUMENT_SCHEMA` is what says what may be in there.
      eb.ref("writingPost.document").$castTo<PostDocument>().as("document"),
      "user.username as createdByUsername",
      // A subquery rather than a second join on `user`: an alias widens the builder's table
      // set past what `listResultsWithCount` accepts, and this is a primary-key lookup.
      eb.selectFrom("user as editor")
        .select("editor.username")
        .whereRef("editor.id", "=", "writingPost.editedBy")
        .as("editedByUsername"),
    ])
    .where("writingPost.id", "=", postId);
}

async function insertPost(
  transaction: Transaction,
  writingGroupId: string,
  threadId: string,
  document: PostDocument,
  isDraft: boolean,
  createdBy: string,
): Promise<Post> {
  const { id } = await transaction
    .insertInto("writingPost")
    // `text` is derived here rather than accepted, so it cannot disagree with the document.
    .values({
      writingThreadId: threadId,
      // An object, not a string: `JSON.stringify` here would store a jsonb *string* rather
      // than a document.
      document,
      text: documentToPlainText(document),
      isDraft,
      createdBy,
    })
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
  return await postWithAuthorById(id, createdBy, transaction)
    .executeTakeFirstOrThrow();
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
    .$call((builder) =>
      withFavourite(builder, "writing_post", "writingPost.id", viewerId)
    )
    .select((eb) => [
      ...SELECTED_COLUMNS,
      // Cast rather than selected plainly: the column's generated type is `unknown`, and
      // `DOCUMENT_SCHEMA` is what says what may be in there.
      eb.ref("writingPost.document").$castTo<PostDocument>().as("document"),
      "user.username as createdByUsername",
      // A subquery rather than a second join on `user`: an alias widens the builder's table
      // set past what `listResultsWithCount` accepts, and this is a primary-key lookup.
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
  executor: typeof db | Transaction = db,
): Promise<Post | undefined> {
  return await postsWithAuthor(viewerId, executor)
    .where("writingPost.writingThreadId", "=", threadId)
    .where("writingPost.id", "=", postId)
    .executeTakeFirst();
}

function listPosts(
  threadId: string,
  viewerId: string,
  query: ListQuery & { isDraft: boolean; favourite: FavouriteFilter },
): Promise<ListResults<Post>> {
  // **No favourites-first ordering here, deliberately.** A thread is prose and reads in the order
  // it was written, so hoisting a favourited post above the paragraph before it would break the
  // reading. What a favourite earns a post is the thread's own filter, which is what #37 asked
  // for before this issue absorbed it.
  return listResultsWithCount(
    postsWithAuthor(viewerId)
      .where("writingPost.writingThreadId", "=", threadId)
      .where("writingPost.isDraft", "=", query.isDraft)
      .$if(
        query.favourite === "only",
        (queryBuilder) => queryBuilder.where("favourite.id", "is not", null),
      )
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

/**
 * Returns nothing when there is no such post; authorisation is the caller's job.
 *
 * `wasDraft` is the row's state before this change, which is what separates the three ways a
 * post can be written to: autosaving a draft, publishing one, and editing what is already
 * published. Only the last is an edit a reader is told about.
 */
async function updatePost(
  transaction: Transaction,
  postId: string,
  changes: { document?: PostDocument; isDraft?: boolean },
  wasDraft: boolean,
  context: {
    /**
     * Null for the public forum, whose posts belong to no group (#32) — and who hears about one
     * is #119, so there is nothing to announce yet. Announcing it to a group's
     * members would be the wrong answer anyway.
     */
    writingGroupId: string | null;
    writingThreadId: string;
    actorId: string;
  },
): Promise<Post | undefined> {
  const { document, ...rest } = changes;
  const isPublishing = wasDraft && changes.isDraft === false;
  const isEditingPublished = !wasDraft && document !== undefined;

  const updated = await transaction
    .updateTable("writingPost")
    .set({
      ...rest,
      // Both columns move together, or the projection would describe a body it no longer has.
      ...(document !== undefined
        ? {
          document,
          text: documentToPlainText(document),
        }
        : {}),
      // A post is born when it is published, not when its draft was first autosaved: a
      // piece drafted over three days would otherwise appear dated three days ago and sort
      // into the middle of the thread it belongs at the end of.
      ...(isPublishing ? { createdAt: Temporal.Now.instant().toString() } : {}),
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
  if (isPublishing && context.writingGroupId !== null) {
    await NotificationService.insertGroupActivityNotifications(transaction, {
      type: "new_writing_post",
      writingGroupId: context.writingGroupId,
      writingThreadId: context.writingThreadId,
      writingPostId: updated.id,
      actorId: context.actorId,
    });
  }

  return await postWithAuthorById(updated.id, context.actorId, transaction)
    .executeTakeFirstOrThrow();
}

async function deletePost(
  transaction: Transaction,
  postId: string,
): Promise<boolean> {
  const deletion = await transaction
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
