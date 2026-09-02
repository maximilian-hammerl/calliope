import type { Selectable } from "kysely";
import { db, type Transaction } from "@/src/database/client.ts";
import { withFavourite } from "@/src/query/favourite.ts";
import type { User } from "@/src/service/user_service.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
  searchPattern,
} from "@/src/list/list_endpoint_query.ts";
import { NotificationService } from "@/src/service/notification_service.ts";
import type { WritingPage as DatabaseWritingPage } from "@/src/database/schema.ts";
import type { PostDocument } from "@/src/document/document_schema.ts";
import { documentToPlainText } from "@/src/document/document_text.ts";

/** What the rail needs: everything but the prose, so listing a group is not a bulk download. */
export type PageSummary =
  & Pick<
    Selectable<DatabaseWritingPage>,
    | "id"
    | "writingGroupId"
    | "title"
    | "createdBy"
    | "createdAt"
    | "lastActivityAt"
    | "folderId"
    | "updatedBy"
  >
  // Null once an account is gone: both columns are ON DELETE SET NULL.
  & { createdByUsername: string | null; updatedByUsername: string | null }
  & {
    /** The reader's own favourite, visible to nobody else. */
    isFavourite: boolean;
  };

// `document` is not picked from the table, where the column is `unknown` by design.
export type Page = PageSummary & { document: PostDocument };

/**
 * What the gates need: the page itself, with nothing about who is reading it. Three routes use
 * this only to authorise and would discard a favourite flag — the view asks `selectPageForReader`.
 */
export type PageGate = Omit<Page, "isFavourite">;

const SELECTED_COLUMNS = [
  "writingPage.id",
  "writingPage.writingGroupId",
  "writingPage.title",
  "writingPage.createdBy",
  "writingPage.createdAt",
  "writingPage.lastActivityAt",
  "writingPage.folderId",
  "writingPage.updatedBy",
] as const;

/**
 * The same, plus whether this reader has favourited it. Takes the reader because a favourite is a
 * fact about the pair, and the join is bound to their id so no query here can see another
 * member's.
 */
function pagesForReader(
  readerId: string,
  executor: typeof db | Transaction = db,
) {
  return withFavourite(
    pagesWithNames(executor),
    "writing_page",
    "writingPage.id",
    readerId,
  );
}

/**
 * Both names are joined rather than stored, so they follow a rename, and both tolerate a
 * deleted account. The editor comes from a subquery for the reason `writing_post_service`
 * gives: a second alias on `user` widens the builder's table set, and this is a key lookup.
 */
function pagesWithNames(executor: typeof db | Transaction = db) {
  return executor
    .selectFrom("writingPage")
    .leftJoin("user", "user.id", "writingPage.createdBy")
    .select((eb) => [
      ...SELECTED_COLUMNS,
      "user.username as createdByUsername",
      eb.selectFrom("user as editor")
        .select("editor.username")
        .whereRef("editor.id", "=", "writingPage.updatedBy")
        .as("updatedByUsername"),
    ]);
}

/**
 * Every page of a group, most recently written in first — the tree assembles them by `folderId`,
 * and orders leaves by activity the way a thread's strip did.
 */
async function listPages(
  writingGroupId: string,
  readerId: string,
): Promise<PageSummary[]> {
  return await pagesForReader(readerId)
    .where("writingPage.writingGroupId", "=", writingGroupId)
    .orderBy("writingPage.lastActivityAt", "desc")
    // `id` breaks ties, and they are the ordinary case rather than an edge: one INSERT shares one
    // `now()`, so everything created together carries the same timestamp — three of the seed's
    // four pages do. Without it the order among those rows is whatever Postgres returns, which
    // is unspecified and can shift. uuidv7 is time-ordered, so this reads as newest first.
    .orderBy("writingPage.id", "desc")
    .execute();
}

/** Scoped to the group, so a page id from another group cannot be reached through it. */
async function selectPage(
  writingGroupId: string,
  pageId: string,
): Promise<PageGate | undefined> {
  return await pagesWithNames()
    .select((eb) =>
      eb.ref("writingPage.document").$castTo<PostDocument>().as("document")
    )
    .where("writingPage.writingGroupId", "=", writingGroupId)
    .where("writingPage.id", "=", pageId)
    .executeTakeFirst();
}

async function insertPage(
  writingGroupId: string,
  title: string,
  document: PostDocument,
  createdBy: string,
  /** Null puts it at the root of the group's tree, which is where a page starts. */
  folderId: string | null = null,
): Promise<Page> {
  return await db.transaction().execute(async (transaction) => {
    const { id } = await transaction
      .insertInto("writingPage")
      .values({
        writingGroupId,
        title,
        folderId,
        // An object, not a string: stringifying here stores a jsonb *string*.
        document,
        // Derived here and never accepted from the client, as a post's projection is.
        text: documentToPlainText(document),
        createdBy,
        // The creator counts as the first editor, so a refusal can name somebody from the start.
        updatedBy: createdBy,
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await NotificationService.insertGroupActivityNotifications(transaction, {
      type: "new_writing_page",
      writingGroupId,
      writingPageId: id,
      actorId: createdBy,
    });

    // Re-read rather than RETURNING, which cannot reach the joined names.
    const page = await pagesWithNames(transaction)
      .select((eb) =>
        eb.ref("writingPage.document").$castTo<PostDocument>().as("document")
      )
      .where("writingPage.writingGroupId", "=", writingGroupId)
      .where("writingPage.id", "=", id)
      .executeTakeFirstOrThrow();

    // Writing a page does not favourite it — that is the member's own act, available the moment
    // this returns. Stated rather than joined, inside the transaction that made it.
    return { ...page, isFavourite: false };
  });
}

/** The page as its own view reads it, favourite included. */
async function selectPageForReader(
  writingGroupId: string,
  pageId: string,
  readerId: string,
): Promise<Page | undefined> {
  return await pagesForReader(readerId)
    .select((eb) =>
      eb.ref("writingPage.document").$castTo<PostDocument>().as("document")
    )
    .where("writingPage.writingGroupId", "=", writingGroupId)
    .where("writingPage.id", "=", pageId)
    .executeTakeFirst();
}

/** A page with the group it belongs to, which a cross-group list has to name. */
export type FoundPage = PageSummary & { writingGroupTitle: string };

/**
 * Pages across every group the member may see: their own, and public ones they have not joined —
 * the same rule threads use, applied to the other leaf.
 *
 * Matched on the title *and* the prose, through the `text` projection. A thread has no body, so
 * this is the one place a leaf can match on something the result row does not show; the row still
 * carries only the title, as every other kind's does.
 */
function listVisiblePages(
  user: User,
  query: ListQuery,
): Promise<ListResults<FoundPage>> {
  let pages = pagesForReader(user.id)
    .innerJoin(
      "writingGroup",
      "writingGroup.id",
      "writingPage.writingGroupId",
    )
    .leftJoin(
      "userInWritingGroup",
      (join) =>
        join
          .onRef("userInWritingGroup.writingGroupId", "=", "writingGroup.id")
          .on("userInWritingGroup.userId", "=", user.id),
    )
    .where((eb) =>
      eb.or([
        eb("writingGroup.visibility", "=", "public"),
        eb("userInWritingGroup.userId", "is not", null),
      ])
    )
    .select("writingGroup.title as writingGroupTitle");

  if (query.search !== undefined) {
    const term = searchPattern(query.search);
    pages = pages.where((eb) =>
      eb.or([
        eb("writingPage.title", "ilike", term),
        eb("writingPage.text", "ilike", term),
      ])
    );
  }

  return listResultsWithCount(pages, query);
}

export type UpdateOutcome =
  | { kind: "updated"; page: Page }
  /** Somebody wrote in the meantime, and `page` is what they left. */
  | { kind: "stale"; page: Page };

/**
 * Conditional on the `lastActivityAt` the editor loaded, so two members cannot silently overwrite
 * one another: a page has no per-member draft the way a post does, and no history to recover
 * from. `undefined` means no such page in that group.
 */
async function updatePage(
  writingGroupId: string,
  pageId: string,
  loadedAt: string,
  values: { title: string; document: PostDocument },
  updatedBy: string,
): Promise<UpdateOutcome | undefined> {
  const written = await db
    .updateTable("writingPage")
    .set({
      title: values.title,
      document: values.document,
      text: documentToPlainText(values.document),
      updatedBy,
      // `last_activity_at` is the trigger's to write.
    })
    .where("writingGroupId", "=", writingGroupId)
    .where("id", "=", pageId)
    .where("lastActivityAt", "=", loadedAt)
    .returning(["id"])
    .executeTakeFirst();

  // The editor's own favourite, because the response carries it like every other page does.
  const page = await selectPageForReader(writingGroupId, pageId, updatedBy);
  if (page === undefined) {
    return undefined;
  }
  return { kind: written === undefined ? "stale" : "updated", page };
}

/**
 * Only `folder_id`, which is what keeps this out of the activity trigger — see
 * `20260902160000_activity_ignores_a_move.sql`. `undefined` means no such page in that group.
 */
async function movePage(
  writingGroupId: string,
  pageId: string,
  folderId: string | null,
  readerId: string,
): Promise<Page | undefined> {
  await db
    .updateTable("writingPage")
    .set({ folderId })
    .where("writingGroupId", "=", writingGroupId)
    .where("id", "=", pageId)
    .execute();

  return await selectPageForReader(writingGroupId, pageId, readerId);
}

async function deletePage(
  writingGroupId: string,
  pageId: string,
): Promise<void> {
  await db
    .deleteFrom("writingPage")
    .where("writingGroupId", "=", writingGroupId)
    .where("id", "=", pageId)
    .execute();
}

export const WritingPageService = {
  listPages,
  listVisiblePages,
  selectPage,
  selectPageForReader,
  insertPage,
  updatePage,
  movePage,
  deletePage,
};
