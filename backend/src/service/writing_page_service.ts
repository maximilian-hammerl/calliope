import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
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
    | "updatedAt"
    | "updatedBy"
  >
  // Null once an account is gone: both columns are ON DELETE SET NULL.
  & { createdByUsername: string | null; updatedByUsername: string | null };

// `document` is not picked from the table, where the column is `unknown` by design.
export type Page = PageSummary & { document: PostDocument };

const SELECTED_COLUMNS = [
  "writingPage.id",
  "writingPage.writingGroupId",
  "writingPage.title",
  "writingPage.createdBy",
  "writingPage.createdAt",
  "writingPage.updatedAt",
  "writingPage.updatedBy",
] as const;

/**
 * Both names are joined rather than stored, so they follow a rename, and both tolerate a
 * deleted account. The editor comes from a subquery for the reason `writing_post_service`
 * gives: a second alias on `user` widens the builder's table set, and this is a key lookup.
 */
function pagesWithNames() {
  return db
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

/** Every page of a group, oldest first — the rail shows them in the order they were made. */
async function listPages(writingGroupId: string): Promise<PageSummary[]> {
  return await pagesWithNames()
    .where("writingPage.writingGroupId", "=", writingGroupId)
    .orderBy("writingPage.createdAt", "asc")
    .execute();
}

/** Scoped to the group, so a page id from another group cannot be reached through it. */
async function selectPage(
  writingGroupId: string,
  pageId: string,
): Promise<Page | undefined> {
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
): Promise<Page> {
  const { id } = await db
    .insertInto("writingPage")
    .values({
      writingGroupId,
      title,
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

  // Re-read rather than RETURNING, which cannot reach the joined names.
  const page = await selectPage(writingGroupId, id);
  if (page === undefined) {
    throw new Error(`Page ${id} could not be read back after writing it`);
  }
  return page;
}

export type UpdateOutcome =
  | { kind: "updated"; page: Page }
  /** Somebody wrote in the meantime, and `page` is what they left. */
  | { kind: "stale"; page: Page };

/**
 * Conditional on the `updatedAt` the editor loaded, so two members cannot silently overwrite
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
      // `updated_at` is the `set_updated_at` trigger's to write.
    })
    .where("writingGroupId", "=", writingGroupId)
    .where("id", "=", pageId)
    .where("updatedAt", "=", loadedAt)
    .returning(["id"])
    .executeTakeFirst();

  const page = await selectPage(writingGroupId, pageId);
  if (page === undefined) {
    return undefined;
  }
  return { kind: written === undefined ? "stale" : "updated", page };
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
  selectPage,
  insertPage,
  updatePage,
  deletePage,
};
