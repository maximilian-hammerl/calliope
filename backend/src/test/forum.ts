import { db } from "@/src/database/client.ts";
import type { ForumPermission } from "@/src/database/schema.ts";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import { MAX_FOLDER_DEPTH } from "@/src/service/writing_folder_service.ts";

/**
 * Forum content is inserted straight into the tables: no endpoint creates a folder yet (#32's
 * seventh slice), and `writing_group_id` being null is what makes a row the forum's.
 *
 * **There is only one forum**, so a test cannot isolate itself by making its own — the seed's rows
 * are in every list. Each fixture records what it made and `clearForum` removes only that.
 */

const made: { folders: string[]; threads: string[]; pages: string[] } = {
  folders: [],
  threads: [],
  pages: [],
};

export async function createForumFolder(
  title: string,
  memberPermission: ForumPermission,
  parentFolderId: string | null = null,
): Promise<{ id: string }> {
  const parent = parentFolderId === null ? undefined : await db
    .selectFrom("writingFolder")
    .select("depth")
    .where("id", "=", parentFolderId)
    .executeTakeFirstOrThrow();

  // `effective_member_permission` is the database's to derive, so nothing here computes it.
  const folder = await db
    .insertInto("writingFolder")
    .values({
      writingGroupId: null,
      parentFolderId,
      depth: (parent?.depth ?? 0) + 1,
      title,
      memberPermission,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  made.folders.push(folder.id);
  return folder;
}

export async function createForumThread(
  title: string,
  memberPermission: ForumPermission = "write",
  folderId: string | null = null,
): Promise<{ id: string }> {
  const thread = await db
    .insertInto("writingThread")
    .values({ writingGroupId: null, folderId, title, memberPermission })
    .returning("id")
    .executeTakeFirstOrThrow();

  made.threads.push(thread.id);
  return thread;
}

/** Closes a thread to members. Straight to the column: changing a permission is slice 7. */
export async function closeForumThread(threadId: string): Promise<void> {
  await db
    .updateTable("writingThread")
    .set({ memberPermission: "read" })
    .where("id", "=", threadId)
    .execute();
}

export async function createForumPost(
  writingThreadId: string,
  text: string,
  createdBy: string,
): Promise<{ id: string }> {
  return await db
    .insertInto("writingPost")
    .values({
      writingThreadId,
      document: plainTextToDocument(text),
      text,
      isDraft: false,
      createdBy,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
}

export async function createForumPage(
  title: string,
  text: string,
  memberPermission: ForumPermission = "write",
  folderId: string | null = null,
): Promise<{ id: string }> {
  const page = await db
    .insertInto("writingPage")
    .values({
      writingGroupId: null,
      folderId,
      title,
      document: plainTextToDocument(text),
      text,
      memberPermission,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  made.pages.push(page.id);
  return page;
}

/** Deletes what these fixtures made, and nothing else — see the note at the top. */
export async function clearForum(usernames: string[] = []): Promise<void> {
  // Two passes per kind: what the fixtures made, and what these accounts wrote through the API,
  // whose ids this module never sees. Before the accounts go — `created_by` is ON DELETE SET
  // NULL, so deleting the users first would leave nothing to find these rows by.
  const authors = db
    .selectFrom("user")
    .select("id")
    .where("username", "in", usernames);

  if (made.pages.length > 0) {
    await db.deleteFrom("writingPage").where("id", "in", made.pages).execute();
  }
  if (usernames.length > 0) {
    await db.deleteFrom("writingPage")
      .where("writingGroupId", "is", null)
      .where("createdBy", "in", authors)
      .execute();
  }

  // Posts go with the thread through the foreign key's cascade.
  if (made.threads.length > 0) {
    await db.deleteFrom("writingThread").where("id", "in", made.threads)
      .execute();
  }
  if (usernames.length > 0) {
    await db.deleteFrom("writingThread")
      .where("writingGroupId", "is", null)
      .where("createdBy", "in", authors)
      .execute();
  }

  // Newest first, which is children before parents here: `parent_folder_id` is RESTRICT, and it
  // is checked per row rather than at the end of the statement, so one `in` would refuse.
  for (const folderId of [...made.folders].reverse()) {
    // deno-lint-ignore no-await-in-loop
    await db.deleteFrom("writingFolder").where("id", "=", folderId).execute();
  }

  // And the ones the API made, whose ids this module never sees — slice 7 gave the forum a create,
  // so a route test leaves folders behind exactly as it leaves threads and pages. Deepest first,
  // for the RESTRICT above.
  if (usernames.length > 0) {
    for (let depth = MAX_FOLDER_DEPTH; depth >= 1; depth--) {
      // deno-lint-ignore no-await-in-loop
      await db.deleteFrom("writingFolder")
        .where("writingGroupId", "is", null)
        .where("depth", "=", depth)
        .where("createdBy", "in", authors)
        .execute();
    }
  }

  made.folders = [];
  made.threads = [];
  made.pages = [];
}
