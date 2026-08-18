import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type { Thread as DatabaseThread } from "@/src/database/schema.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
} from "@/src/list_endpoint_query.ts";

export type Thread =
  & Pick<
    Selectable<DatabaseThread>,
    | "id"
    | "writingGroupId"
    | "title"
    | "createdBy"
    | "createdAt"
    | "updatedAt"
    | "lastActivityAt"
  >
  // Null once the author has deleted their account, because created_by is ON DELETE SET NULL.
  & { createdByUsername: string | null };

const SELECTED_COLUMNS = [
  "thread.id",
  "thread.writingGroupId",
  "thread.title",
  "thread.createdBy",
  "thread.createdAt",
  "thread.updatedAt",
  "thread.lastActivityAt",
] as const;

/**
 * The author's name is joined in rather than stored, so it follows a rename. The join is
 * left: an account that has been deleted leaves the post behind with no author.
 */
function threadsWithAuthor() {
  return db
    .selectFrom("thread")
    .leftJoin("user", "user.id", "thread.createdBy")
    .select([...SELECTED_COLUMNS, "user.username as createdByUsername"]);
}

async function insertThread(
  writingGroupId: string,
  title: string,
  createdBy: string,
): Promise<Thread> {
  const { id } = await db
    .insertInto("thread")
    .values({ writingGroupId, title, createdBy })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  // Re-read rather than RETURNING, which cannot reach the joined author name.
  return await threadsWithAuthor()
    .where("thread.id", "=", id)
    .executeTakeFirstOrThrow();
}

/** Scoped to the group, so a thread id from another group cannot be reached through it. */
async function selectThread(
  writingGroupId: string,
  threadId: string,
): Promise<Thread | undefined> {
  return await threadsWithAuthor()
    .where("thread.writingGroupId", "=", writingGroupId)
    .where("thread.id", "=", threadId)
    .executeTakeFirst();
}

function listThreads(
  writingGroupId: string,
  query: ListQuery,
): Promise<ListResults<Thread>> {
  return listResultsWithCount(
    threadsWithAuthor().where("thread.writingGroupId", "=", writingGroupId),
    query,
  );
}

/** Returns nothing when there is no such thread. Authorisation is the caller's job. */
async function updateThread(
  threadId: string,
  changes: { title?: string },
): Promise<Thread | undefined> {
  const updated = await db
    .updateTable("thread")
    .set(changes)
    .where("id", "=", threadId)
    .returning(["id"])
    .executeTakeFirst();

  if (updated === undefined) {
    return undefined;
  }

  return await threadsWithAuthor()
    .where("thread.id", "=", updated.id)
    .executeTakeFirstOrThrow();
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
