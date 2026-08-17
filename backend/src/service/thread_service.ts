import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type { Thread as DatabaseThread } from "@/src/database/schema.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
} from "@/src/list_endpoint_query.ts";

export type Thread = Pick<
  Selectable<DatabaseThread>,
  "id" | "writingGroupId" | "title" | "createdBy" | "createdAt" | "updatedAt"
>;

const SELECTED_COLUMNS = [
  "thread.id",
  "thread.writingGroupId",
  "thread.title",
  "thread.createdBy",
  "thread.createdAt",
  "thread.updatedAt",
] as const;

const RETURNED_COLUMNS = [
  "id",
  "writingGroupId",
  "title",
  "createdBy",
  "createdAt",
  "updatedAt",
] as const;

function insertThread(
  writingGroupId: string,
  title: string,
  createdBy: string,
): Promise<Thread> {
  return db
    .insertInto("thread")
    .values({ writingGroupId, title, createdBy })
    .returning(RETURNED_COLUMNS)
    .executeTakeFirstOrThrow();
}

/** Scoped to the group, so a thread id from another group cannot be reached through it. */
async function selectThread(
  writingGroupId: string,
  threadId: string,
): Promise<Thread | undefined> {
  return await db
    .selectFrom("thread")
    .select(SELECTED_COLUMNS)
    .where("thread.writingGroupId", "=", writingGroupId)
    .where("thread.id", "=", threadId)
    .executeTakeFirst();
}

function listThreads(
  writingGroupId: string,
  query: ListQuery,
): Promise<ListResults<Thread>> {
  return listResultsWithCount(
    db
      .selectFrom("thread")
      .select(SELECTED_COLUMNS)
      .where("thread.writingGroupId", "=", writingGroupId),
    query,
  );
}

/** Returns nothing when there is no such thread. Authorisation is the caller's job. */
async function updateThread(
  threadId: string,
  changes: { title?: string },
): Promise<Thread | undefined> {
  return await db
    .updateTable("thread")
    .set(changes)
    .where("id", "=", threadId)
    .returning(RETURNED_COLUMNS)
    .executeTakeFirst();
}

async function deleteThread(threadId: string): Promise<boolean> {
  // Posts go with the thread through the foreign key's cascade.
  const deletion = await db
    .deleteFrom("thread")
    .where("id", "=", threadId)
    .executeTakeFirst();

  return deletion.numDeletedRows > 0n;
}

export const ThreadService = {
  insertThread,
  selectThread,
  listThreads,
  updateThread,
  deleteThread,
};
