import type { Selectable } from "kysely";
import { db, type Transaction } from "@/src/database/client.ts";
import { NotificationService } from "@/src/service/notification_service.ts";
import type { WritingThread as DatabaseWritingThread } from "@/src/database/schema.ts";
import type { User } from "@/src/service/user_service.ts";
import { withFavourite } from "@/src/query/favourite.ts";
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
/**
 * A thread as search returns it. It carries the reader's favourite like every other thread does —
 * but search is not *ordered* by it, unlike the lists: a search ranks by relevance to the term,
 * and floating a favourite above a better match would answer a question nobody asked.
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
    | "folderId"
  >
  // Null once the author has deleted their account, because created_by is ON DELETE SET NULL.
  & { createdByUsername: string | null }
  & {
    /** The reader's own favourite, visible to nobody else. */
    isFavourite: boolean;
  };

/** What the gates need: the thread itself, with nothing about who is reading it. */
export type ThreadGate = Omit<Thread, "isFavourite">;

const SELECTED_COLUMNS = [
  "writingThread.id",
  "writingThread.writingGroupId",
  "writingThread.title",
  "writingThread.createdBy",
  "writingThread.createdAt",
  "writingThread.lastActivityAt",
  "writingThread.folderId",
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

/**
 * The same, plus whether this reader has favourited it. Takes the reader because a favourite is a
 * fact about the pair, and the join is bound to their id so no query here can see another
 * member's.
 */
function threadsForReader(readerId: string) {
  return threadsWithAuthor()
    .$call((builder) =>
      withFavourite(builder, "writing_thread", "writingThread.id", readerId)
    );
}

async function insertThread(
  writingGroupId: string,
  title: string,
  createdBy: string,
  /** Null puts it at the root of the group's tree, which is where a thread starts. */
  folderId: string | null = null,
): Promise<Thread> {
  return await db.transaction().execute(async (transaction) => {
    const { id } = await transaction
      .insertInto("writingThread")
      .values({ writingGroupId, title, createdBy, folderId })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await NotificationService.insertGroupActivityNotifications(transaction, {
      type: "new_writing_thread",
      writingGroupId,
      writingThreadId: id,
      actorId: createdBy,
    });

    // Re-read rather than RETURNING, which cannot reach the joined author name.
    const thread = await threadsWithAuthor(transaction)
      .where("writingThread.id", "=", id)
      .executeTakeFirstOrThrow();

    // Creating a thread does not favourite it — that is the member's own act, and one they can
    // take the moment this returns. Stated rather than joined, inside the transaction that made it.
    return { ...thread, isFavourite: false };
  });
}

/** Scoped to the group, so a thread id from another group cannot be reached through it. */
/**
 * Whether the thread exists in that group, and who wrote it. Four of the five callers use this as
 * a gate and would only discard a favourite flag, so it does not join one — the page that renders
 * a thread asks `selectThreadForReader`.
 */
async function selectThread(
  writingGroupId: string,
  threadId: string,
): Promise<ThreadGate | undefined> {
  return await threadsWithAuthor()
    .where("writingThread.writingGroupId", "=", writingGroupId)
    .where("writingThread.id", "=", threadId)
    .executeTakeFirst();
}

/** The thread as this reader sees it, favourite included. */
async function selectThreadForReader(
  writingGroupId: string,
  threadId: string,
  readerId: string,
): Promise<Thread | undefined> {
  return await threadsForReader(readerId)
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
  readerId: string,
): Promise<Array<Thread>> {
  return threadsForReader(readerId)
    .where("writingThread.writingGroupId", "=", writingGroupId)
    // Most recently written in first, and no longer favourites before that: the tree nests these
    // by `folderId`, and a favourite jumping above its siblings makes a structure a member built
    // themselves look unstable. `FavouriteMark` still marks the row.
    .orderBy("writingThread.lastActivityAt", "desc")
    // `id` breaks ties, and they are the ordinary case rather than an edge: one INSERT shares one
    // `now()`, so everything created together carries the same timestamp — three of the seed's
    // four pages do. Without it the order among those rows is whatever Postgres returns, which
    // is unspecified and can shift. uuidv7 is time-ordered, so this reads as newest first.
    .orderBy("writingThread.id", "desc")
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
  let threads = threadsForReader(user.id)
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
    .where((eb) =>
      eb.or([
        eb("writingGroup.visibility", "=", "public"),
        eb("userInWritingGroup.userId", "is not", null),
      ])
    )
    .select("writingGroup.title as writingGroupTitle");

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
  editedBy: string,
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

  // Re-read with the editor's own favourite, because the response carries it like every other
  // thread does. Renaming a thread does not change whether they keep it.
  return await threadsForReader(editedBy)
    .where("writingThread.id", "=", updated.id)
    .executeTakeFirstOrThrow();
}

/**
 * Only `folder_id`, which is what keeps a move out of the activity trigger — see the comment on
 * it in `20260816131054_last_activity_at.sql`. The reader is taken for the same reason
 * `updateThread` takes it: the response carries their own favourite.
 */
async function moveThread(
  threadId: string,
  folderId: string | null,
  readerId: string,
): Promise<Thread | undefined> {
  const moved = await db
    .updateTable("writingThread")
    .set({ folderId })
    .where("id", "=", threadId)
    .returning(["id"])
    .executeTakeFirst();

  if (moved === undefined) {
    return undefined;
  }

  return await threadsForReader(readerId)
    .where("writingThread.id", "=", moved.id)
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
  moveThread,
  selectThread,
  selectThreadForReader,
  selectThreads,
  listVisibleThreads,
  updateThread,
  deleteThread,
};
