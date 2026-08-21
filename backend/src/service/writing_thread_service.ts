import type { Selectable } from "kysely";
import { db, type Transaction } from "@/src/database/client.ts";
import { NotificationService } from "@/src/service/notification_service.ts";
import type { WritingThread as DatabaseWritingThread } from "@/src/database/schema.ts";
import type { User } from "@/src/service/user_service.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
  searchPattern,
} from "@/src/list/list_endpoint_query.ts";

/**
 * A thread found by a search, which can come from any group the member may see — so it says
 * which one. A thread listed inside a group never needs that, because the group is the page
 * you are already on.
 */
export type FoundThread = Thread & { writingGroupTitle: string };

export type Thread =
  & Pick<
    Selectable<DatabaseWritingThread>,
    | "id"
    | "writingGroupId"
    | "title"
    | "createdBy"
    | "createdAt"
    | "lastActivityAt"
  >
  // Null once the author has deleted their account, because created_by is ON DELETE SET NULL.
  & { createdByUsername: string | null };

const SELECTED_COLUMNS = [
  "writingThread.id",
  "writingThread.writingGroupId",
  "writingThread.title",
  "writingThread.createdBy",
  "writingThread.createdAt",
  "writingThread.lastActivityAt",
] as const;

/**
 * The author's name is joined in rather than stored, so it follows a rename. The join is
 * left: an account that has been deleted leaves the post behind with no author.
 */
function threadsWithAuthor(executor: typeof db | Transaction = db) {
  return executor
    .selectFrom("writingThread")
    .leftJoin("user", "user.id", "writingThread.createdBy")
    .select([...SELECTED_COLUMNS, "user.username as createdByUsername"]);
}

async function insertThread(
  writingGroupId: string,
  title: string,
  createdBy: string,
): Promise<Thread> {
  return await db.transaction().execute(async (transaction) => {
    const { id } = await transaction
      .insertInto("writingThread")
      .values({ writingGroupId, title, createdBy })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await NotificationService.insertGroupActivityNotifications(transaction, {
      type: "new_writing_thread",
      writingGroupId,
      writingThreadId: id,
      actorId: createdBy,
    });

    // Re-read rather than RETURNING, which cannot reach the joined author name.
    return await threadsWithAuthor(transaction)
      .where("writingThread.id", "=", id)
      .executeTakeFirstOrThrow();
  });
}

/** Scoped to the group, so a thread id from another group cannot be reached through it. */
async function selectThread(
  writingGroupId: string,
  threadId: string,
): Promise<Thread | undefined> {
  return await threadsWithAuthor()
    .where("writingThread.writingGroupId", "=", writingGroupId)
    .where("writingThread.id", "=", threadId)
    .executeTakeFirst();
}

/**
 * Every thread of the group, most recently written in first, and deliberately not a page.
 *
 * The interface shows them as one tab strip, which is the only way between threads: a thread
 * missing from it is a thread nobody can reach, and the open one has to be in it or its own tab
 * is gone. Threads do accumulate, unlike members — when a strip gets unwieldy the answer is a
 * list of its own rather than a page of tabs, and this is where to start.
 */
function selectThreads(
  writingGroupId: string,
): Promise<Array<Thread>> {
  return threadsWithAuthor()
    .where("writingThread.writingGroupId", "=", writingGroupId)
    .orderBy("writingThread.lastActivityAt", "desc")
    .execute();
}

/**
 * Threads across every group the member may see: their own, and public ones they have not
 * joined — the same rule the group list uses, applied one level down. Inner joins, because a
 * thread without a group cannot exist.
 */
function listVisibleThreads(
  user: User,
  query: ListQuery,
): Promise<ListResults<FoundThread>> {
  let threads = db
    .selectFrom("writingThread")
    .innerJoin(
      "writingGroup",
      "writingGroup.id",
      "writingThread.writingGroupId",
    )
    .leftJoin(
      "userInWritingGroup",
      (join) =>
        join
          .onRef("userInWritingGroup.writingGroupId", "=", "writingGroup.id")
          .on("userInWritingGroup.userId", "=", user.id),
    )
    .leftJoin("user", "user.id", "writingThread.createdBy")
    .where((eb) =>
      eb.or([
        eb("writingGroup.visibility", "=", "public"),
        eb("userInWritingGroup.userId", "is not", null),
      ])
    )
    .select([
      ...SELECTED_COLUMNS,
      "user.username as createdByUsername",
      "writingGroup.title as writingGroupTitle",
    ]);

  if (query.search !== undefined) {
    threads = threads.where(
      "writingThread.title",
      "ilike",
      searchPattern(query.search),
    );
  }

  return listResultsWithCount(threads, query);
}

async function updateThread(
  threadId: string,
  changes: { title?: string },
): Promise<Thread | undefined> {
  const updated = await db
    .updateTable("writingThread")
    .set(changes)
    .where("id", "=", threadId)
    .returning(["id"])
    .executeTakeFirst();

  if (updated === undefined) {
    return undefined;
  }

  return await threadsWithAuthor()
    .where("writingThread.id", "=", updated.id)
    .executeTakeFirstOrThrow();
}

async function deleteThread(threadId: string): Promise<boolean> {
  // Posts go with the thread through the foreign key's cascade.
  const deletion = await db
    .deleteFrom("writingThread")
    .where("id", "=", threadId)
    .executeTakeFirst();

  return deletion.numDeletedRows > 0n;
}

export const WritingThreadService = {
  insertThread,
  selectThread,
  selectThreads,
  listVisibleThreads,
  updateThread,
  deleteThread,
};
