import type { NotNull, Selectable } from "kysely";
import { db, type Transaction } from "@/src/database/client.ts";
import { planFolderMove } from "@/src/service/folder_move.ts";
import type { WritingFolder as DatabaseWritingFolder } from "@/src/database/schema.ts";

/** The deepest a member may nest: Weltenbau → Stadt → Viertel → Gebäude → Raum. */
export const MAX_FOLDER_DEPTH = 5;

export type Folder =
  // Not null, unlike the column: it is nullable because the public forum reuses this table (#32),
  // and every read in here is scoped to one group. `$narrowType` is where that is asserted.
  & { writingGroupId: string }
  & Pick<
    Selectable<DatabaseWritingFolder>,
    | "id"
    | "parentFolderId"
    | "depth"
    | "title"
    | "description"
    | "createdBy"
    | "createdAt"
  >
  // Null once an account is gone: `created_by` is ON DELETE SET NULL.
  & { createdByUsername: string | null };

const SELECTED_COLUMNS = [
  "writingFolder.id",
  "writingFolder.writingGroupId",
  "writingFolder.parentFolderId",
  "writingFolder.depth",
  "writingFolder.title",
  "writingFolder.description",
  "writingFolder.createdBy",
  "writingFolder.createdAt",
] as const;

function foldersWithNames(executor: typeof db | Transaction = db) {
  return executor
    .selectFrom("writingFolder")
    .leftJoin("user", "user.id", "writingFolder.createdBy")
    .select([...SELECTED_COLUMNS, "user.username as createdByUsername"]);
}

/** Every folder of a group in creation order, which is the tree's ordering for branches. */
async function listFolders(writingGroupId: string): Promise<Folder[]> {
  return await foldersWithNames()
    .where("writingFolder.writingGroupId", "=", writingGroupId)
    .$narrowType<{ writingGroupId: NotNull }>()
    .orderBy("writingFolder.createdAt", "asc")
    // As the leaf lists do, and ascending to match: folders made in one statement share a
    // timestamp, and uuidv7 keeps them in the order they were made.
    .orderBy("writingFolder.id", "asc")
    .execute();
}

/** Scoped to the group, so a folder id from another group cannot be reached through it. */
async function selectFolder(
  writingGroupId: string,
  folderId: string,
): Promise<Folder | undefined> {
  return await foldersWithNames()
    .where("writingFolder.writingGroupId", "=", writingGroupId)
    .$narrowType<{ writingGroupId: NotNull }>()
    .where("writingFolder.id", "=", folderId)
    .executeTakeFirst();
}

export type CreateOutcome =
  | { kind: "created"; folder: Folder }
  /** No such parent in this group — a folder cannot be the child of another group's. */
  | { kind: "noSuchParent" }
  | { kind: "tooDeep" };

/**
 * `depth` is derived here rather than taken from the client, so the CHECK behind it can only be
 * reached by a bug. A cycle is impossible: a parent is named once, at creation, and must already
 * exist — which stops being true the moment moving a folder lands.
 */
async function insertFolder(
  writingGroupId: string,
  values: {
    title: string;
    description: string | null;
    parentFolderId: string | null;
  },
  createdBy: string,
): Promise<CreateOutcome> {
  return await db.transaction().execute(async (transaction) => {
    let depth = 1;
    if (values.parentFolderId !== null) {
      // Locked, and in the same transaction as the insert. `moveFolder` takes the same lock, so
      // the two serialise: without it a move could shift this parent deeper *between* the read
      // and the insert, leaving the new row with a `depth` that is no longer its parent's plus
      // one — and a subtree that reaches past the limit while every row in it still passes the
      // CHECK on its own.
      const parent = await transaction
        .selectFrom("writingFolder")
        .select(["depth"])
        .where("writingGroupId", "=", writingGroupId)
        .where("id", "=", values.parentFolderId)
        .forUpdate()
        .executeTakeFirst();

      if (parent === undefined) {
        return { kind: "noSuchParent" } as const;
      }
      if (parent.depth >= MAX_FOLDER_DEPTH) {
        return { kind: "tooDeep" } as const;
      }
      depth = parent.depth + 1;
    }

    const { id } = await transaction
      .insertInto("writingFolder")
      .values({ writingGroupId, ...values, depth, createdBy })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    // Re-read rather than RETURNING, which cannot reach the joined name.
    const folder = await foldersWithNames(transaction)
      .where("writingFolder.writingGroupId", "=", writingGroupId)
      .$narrowType<{ writingGroupId: NotNull }>()
      .where("writingFolder.id", "=", id)
      .executeTakeFirstOrThrow();

    return { kind: "created", folder } as const;
  });
}

/** Title and description only: where a folder sits is a move, which is its own slice. */
async function updateFolder(
  writingGroupId: string,
  folderId: string,
  values: { title: string; description: string | null },
): Promise<Folder | undefined> {
  await db
    .updateTable("writingFolder")
    .set(values)
    .where("writingGroupId", "=", writingGroupId)
    .where("id", "=", folderId)
    .execute();

  return await selectFolder(writingGroupId, folderId);
}

export type DeleteOutcome = "deleted" | "notEmpty";

/**
 * Only an empty folder goes: deleting a subtree is unrecoverable with no edit history behind it.
 * The emptiness is a condition on the delete rather than a read before it, so nothing can be
 * added in between — the same shape a page's conditional save uses.
 *
 * `undefined` means no such folder in that group. A delete that changes nothing means one of two
 * things, and they are told apart afterwards rather than conflated: without that, a folder
 * somebody else removed a moment ago is refused as "not empty", which is a lie about why.
 * `updatePage` distinguishes the same pair for the same reason.
 */
async function deleteFolder(
  writingGroupId: string,
  folderId: string,
): Promise<DeleteOutcome | undefined> {
  const { numDeletedRows } = await db
    .deleteFrom("writingFolder")
    .where("writingGroupId", "=", writingGroupId)
    .where("id", "=", folderId)
    .where((eb) =>
      eb.not(eb.exists(
        eb.selectFrom("writingFolder as child")
          .select("child.id")
          .whereRef("child.parentFolderId", "=", "writingFolder.id"),
      ))
    )
    .where((eb) =>
      eb.not(eb.exists(
        eb.selectFrom("writingPage")
          .select("writingPage.id")
          .whereRef("writingPage.folderId", "=", "writingFolder.id"),
      ))
    )
    .where((eb) =>
      eb.not(eb.exists(
        eb.selectFrom("writingThread")
          .select("writingThread.id")
          .whereRef("writingThread.folderId", "=", "writingFolder.id"),
      ))
    )
    .executeTakeFirst();

  if (numDeletedRows > 0n) {
    return "deleted";
  }

  const stillThere = await db
    .selectFrom("writingFolder")
    .select("id")
    .where("writingGroupId", "=", writingGroupId)
    .where("id", "=", folderId)
    .executeTakeFirst();

  return stillThere === undefined ? undefined : "notEmpty";
}

export type MoveOutcome =
  | { kind: "moved"; folder: Folder }
  /** No such target in this group — a folder cannot move under another group's. */
  | { kind: "noSuchParent" }
  /** The target is the folder itself, or something inside it. */
  | { kind: "cycle" }
  /** The subtree is taller than the room left under the target. */
  | { kind: "tooDeep" };

/**
 * Re-parents a folder and rewrites `depth` for everything inside it.
 *
 * The refusal is about the *deepest descendant*, not the folder: a three-level subtree cannot go
 * under a level-four folder even though the folder itself would only land at five.
 *
 * The group's folders are read inside the transaction and locked, then the subtree, its height
 * and the cycle check are worked out here. They are capped at five levels and made by hand, so
 * this is a handful of rows — and locking them serialises two members moving folders in the same
 * group, which is what stops one of them building a cycle out of two valid-looking moves. A cycle
 * would be unrecoverable through the interface, since the tree that renders it walks children.
 *
 * `undefined` means no such folder in that group.
 */
async function moveFolder(
  writingGroupId: string,
  folderId: string,
  parentFolderId: string | null,
): Promise<MoveOutcome | undefined> {
  const outcome = await db.transaction().execute(async (transaction) => {
    // No join here: Postgres refuses FOR UPDATE on the nullable side of an outer one, and the
    // author's name is not needed to decide a move. `insertFolder` takes the same lock.
    const rows = await transaction
      .selectFrom("writingFolder")
      .select(["id", "parentFolderId", "depth"])
      .where("writingGroupId", "=", writingGroupId)
      .forUpdate()
      .execute();

    const plan = planFolderMove(rows, folderId, parentFolderId);
    if (plan === undefined || plan.kind !== "plan") {
      return plan;
    }

    await transaction
      .updateTable("writingFolder")
      .set({ parentFolderId })
      .where("id", "=", folderId)
      .execute();

    // One shift for the whole subtree: every node keeps its distance from the folder above it.
    if (plan.delta !== 0) {
      await transaction
        .updateTable("writingFolder")
        .set((eb) => ({ depth: eb("depth", "+", plan.delta) }))
        .where("id", "in", plan.subtree)
        .execute();
    }

    return { kind: "moved" } as const;
  });

  if (outcome === undefined || outcome.kind !== "moved") {
    return outcome;
  }

  const folder = await selectFolder(writingGroupId, folderId);
  if (folder === undefined) {
    throw new Error(
      `Folder ${folderId} could not be read back after moving it`,
    );
  }
  return { kind: "moved", folder };
}

export const WritingFolderService = {
  listFolders,
  selectFolder,
  insertFolder,
  updateFolder,
  moveFolder,
  deleteFolder,
};
