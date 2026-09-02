import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type { WritingFolder as DatabaseWritingFolder } from "@/src/database/schema.ts";

/** The deepest a member may nest: Weltenbau → Stadt → Viertel → Gebäude → Raum. */
export const MAX_FOLDER_DEPTH = 5;

export type Folder =
  & Pick<
    Selectable<DatabaseWritingFolder>,
    | "id"
    | "writingGroupId"
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

function foldersWithNames() {
  return db
    .selectFrom("writingFolder")
    .leftJoin("user", "user.id", "writingFolder.createdBy")
    .select([...SELECTED_COLUMNS, "user.username as createdByUsername"]);
}

/** Every folder of a group in creation order, which is the tree's ordering for branches. */
async function listFolders(writingGroupId: string): Promise<Folder[]> {
  return await foldersWithNames()
    .where("writingFolder.writingGroupId", "=", writingGroupId)
    .orderBy("writingFolder.createdAt", "asc")
    .execute();
}

/** Scoped to the group, so a folder id from another group cannot be reached through it. */
async function selectFolder(
  writingGroupId: string,
  folderId: string,
): Promise<Folder | undefined> {
  return await foldersWithNames()
    .where("writingFolder.writingGroupId", "=", writingGroupId)
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
  let depth = 1;
  if (values.parentFolderId !== null) {
    const parent = await selectFolder(writingGroupId, values.parentFolderId);
    if (parent === undefined) {
      return { kind: "noSuchParent" };
    }
    if (parent.depth >= MAX_FOLDER_DEPTH) {
      return { kind: "tooDeep" };
    }
    depth = parent.depth + 1;
  }

  const { id } = await db
    .insertInto("writingFolder")
    .values({ writingGroupId, ...values, depth, createdBy })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  // Re-read rather than RETURNING, which cannot reach the joined name.
  const folder = await selectFolder(writingGroupId, id);
  if (folder === undefined) {
    throw new Error(`Folder ${id} could not be read back after writing it`);
  }
  return { kind: "created", folder };
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
 */
async function deleteFolder(
  writingGroupId: string,
  folderId: string,
): Promise<DeleteOutcome> {
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

  return numDeletedRows > 0n ? "deleted" : "notEmpty";
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
    // author's name is not needed to decide a move.
    const rows = await transaction
      .selectFrom("writingFolder")
      .select(["id", "parentFolderId", "depth"])
      .where("writingGroupId", "=", writingGroupId)
      .forUpdate()
      .execute();

    const byId = new Map(rows.map((row) => [row.id, row]));
    const moving = byId.get(folderId);
    if (moving === undefined) {
      return undefined;
    }

    let newDepth = 1;
    if (parentFolderId !== null) {
      const target = byId.get(parentFolderId);
      if (target === undefined) {
        return { kind: "noSuchParent" } as const;
      }

      // Walking up from the target: if the folder being moved is on that path, the target is
      // inside it. Bounded by the depth limit, and by `byId` being a finite map besides.
      for (
        let ancestor: string | null = target.id;
        ancestor !== null;
        ancestor = byId.get(ancestor)?.parentFolderId ?? null
      ) {
        if (ancestor === folderId) {
          return { kind: "cycle" } as const;
        }
      }

      newDepth = target.depth + 1;
    }

    // The subtree, and how far it reaches below the folder itself.
    const subtree: string[] = [];
    const queue = [folderId];
    let height = 0;
    while (queue.length > 0) {
      const id = queue.shift() as string;
      subtree.push(id);
      const row = byId.get(id);
      if (row !== undefined) {
        height = Math.max(height, row.depth - moving.depth);
      }
      for (const row of rows) {
        if (row.parentFolderId === id) queue.push(row.id);
      }
    }

    if (newDepth + height > MAX_FOLDER_DEPTH) {
      return { kind: "tooDeep" } as const;
    }

    const delta = newDepth - moving.depth;

    await transaction
      .updateTable("writingFolder")
      .set({ parentFolderId })
      .where("id", "=", folderId)
      .execute();

    // One shift for the whole subtree: every node keeps its distance from the folder above it.
    if (delta !== 0) {
      await transaction
        .updateTable("writingFolder")
        .set((eb) => ({ depth: eb("depth", "+", delta) }))
        .where("id", "in", subtree)
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
