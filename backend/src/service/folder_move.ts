import { MAX_FOLDER_DEPTH } from "@/src/service/writing_folder_service.ts";

/**
 * What moving a folder comes to, as a decision over rows rather than a query: a writing group's
 * folders and the public forum's live in one table and nest by the same rules, so the tree logic
 * is written once and each service supplies its own scope.
 *
 * Pure on purpose. The queries — which rows, and the lock over them — belong to the caller,
 * because that is the part that differs.
 */

/** All a move needs off a row. Both services select exactly these three. */
export type FolderPlacement = {
  id: string;
  parentFolderId: string | null;
  depth: number;
};

export type MovePlan =
  /** Apply it: set the parent, then shift every id in `subtree` by `delta`. */
  | { kind: "plan"; subtree: Array<string>; delta: number }
  /** No such target in this scope — a folder cannot move under another scope's. */
  | { kind: "noSuchParent" }
  /** The target is the folder itself, or something inside it. */
  | { kind: "cycle" }
  /** The subtree is taller than the room left under the target. */
  | { kind: "tooDeep" };

/**
 * `undefined` when the folder is not among the rows, which is the caller's 404.
 *
 * The depth limit is checked against the subtree's *height*, not the folder alone: moving a folder
 * with children two levels below it needs three levels of room, and every row would still pass its
 * own CHECK while the tree as a whole reached past the limit.
 */
export function planFolderMove(
  rows: ReadonlyArray<FolderPlacement>,
  folderId: string,
  parentFolderId: string | null,
): MovePlan | undefined {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const moving = byId.get(folderId);
  if (moving === undefined) {
    return undefined;
  }

  let newDepth = 1;
  if (parentFolderId !== null) {
    const target = byId.get(parentFolderId);
    if (target === undefined) {
      return { kind: "noSuchParent" };
    }

    // Walking up from the target: if the folder being moved is on that path, the target is
    // inside it. The depth limit bounds the walk, being what keeps a parent chain acyclic.
    for (
      let ancestor: string | null = target.id;
      ancestor !== null;
      ancestor = byId.get(ancestor)?.parentFolderId ?? null
    ) {
      if (ancestor === folderId) {
        return { kind: "cycle" };
      }
    }

    newDepth = target.depth + 1;
  }

  // The subtree, and how far it reaches below the folder itself.
  const subtree: Array<string> = [];
  const queue = [folderId];
  let height = 0;
  while (queue.length > 0) {
    const id = queue.shift() as string;
    subtree.push(id);
    const row = byId.get(id);
    if (row !== undefined) {
      height = Math.max(height, row.depth - moving.depth);
    }
    for (const candidate of rows) {
      if (candidate.parentFolderId === id) queue.push(candidate.id);
    }
  }

  if (newDepth + height > MAX_FOLDER_DEPTH) {
    return { kind: "tooDeep" };
  }

  return { kind: "plan", subtree, delta: newDepth - moving.depth };
}
