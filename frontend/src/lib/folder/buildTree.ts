import type {
  ListFolders200ResultsItem,
  ListPages200ResultsItem,
  ListThreads200ResultsItem,
} from '@/api/models'

/**
 * A thread or a page: both are leaves, and the tree treats them alike apart from where a click
 * goes and which word marks the row.
 */
export type TreeLeaf = {
  kind: 'thread' | 'page'
  id: string
  title: string
  lastActivityAt: string
  isFavourite: boolean
  /** For `mayModify`, so a row only offers what the endpoint would allow. */
  createdBy: string | null
  /** Where it sits now, so a move can mark the current place and skip a pointless request. */
  folderId: string | null
}

export type TreeFolder = {
  kind: 'folder'
  id: string
  title: string
  description: string | null
  depth: number
  /** For `mayModify`, so a row only offers what the endpoint would allow. */
  createdBy: string | null
  children: TreeNode[]
}

export type TreeNode = TreeFolder | TreeLeaf

/** The root's bucket. Not a uuid, so it cannot collide with a folder's id. */
const ROOT = 'root'

function leafOf(
  kind: 'thread' | 'page',
  row: ListThreads200ResultsItem | ListPages200ResultsItem,
): TreeLeaf {
  return {
    kind,
    id: row.id,
    title: row.title,
    lastActivityAt: row.lastActivityAt,
    isFavourite: row.isFavourite,
    createdBy: row.createdBy,
    folderId: row.folderId,
  }
}

function push<T>(map: Map<string, T[]>, key: string, value: T): void {
  const bucket = map.get(key)
  if (bucket === undefined) map.set(key, [value])
  else bucket.push(value)
}

/**
 * Three flat lists into one tree. Assembled on the client rather than by the server: the two
 * leaf lists already carry what their rows need, and a second nested shape of the same rows
 * would have to be kept in step with them.
 *
 * Under each parent, leaves come before folders — a thread at the top of a group is usually an
 * introduction, and the structure belongs under what it introduces. Leaves are ordered by
 * activity, newest first, and folders by creation, which is what keeps a structure where it was
 * put rather than letting it rearrange itself.
 *
 * A row whose parent is not in `folders` is hoisted to the root rather than dropped. The three
 * lists are three queries: one can refresh before another, so a page in a folder made a moment
 * ago may name a folder this tree has not seen yet. Showing it in the wrong place is recoverable
 * on the next refresh; hiding it looks like the writing is gone.
 */
export function buildTree(
  folders: ListFolders200ResultsItem[],
  pages: ListPages200ResultsItem[],
  threads: ListThreads200ResultsItem[],
): TreeNode[] {
  const leavesByParent = new Map<string, TreeLeaf[]>()
  const foldersByParent = new Map<string, ListFolders200ResultsItem[]>()

  const known = new Set<string>(folders.map((folder) => folder.id))
  const bucketFor = (parent: string | null) =>
    parent !== null && known.has(parent) ? parent : ROOT

  for (const thread of threads) {
    push(leavesByParent, bucketFor(thread.folderId), leafOf('thread', thread))
  }
  for (const page of pages) push(leavesByParent, bucketFor(page.folderId), leafOf('page', page))
  for (const folder of folders) {
    push(foldersByParent, bucketFor(folder.parentFolderId), folder)
  }

  /**
   * Threads and pages arrive already ordered, but each in its own list, so the merged bucket is
   * sorted again. The timestamps are ISO with a fixed offset, which compares as text — including
   * a whole second, which Postgres prints with no fractional part at all: `+` sorts before `.`
   * and before any digit, so `…:22+00:00` still precedes `…:22.659192+00:00`.
   *
   * `id` breaks ties, and they are the ordinary case: one INSERT shares one `now()`, so anything
   * created together carries the same timestamp. Without this the tied rows keep the order the
   * API returned them in, which is unspecified. The API sorts by id too, so both agree.
   */
  for (const leaves of leavesByParent.values()) {
    leaves.sort(
      (a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt) || b.id.localeCompare(a.id),
    )
  }

  const childrenOf = (key: string): TreeNode[] => [
    ...(leavesByParent.get(key) ?? []),
    ...(foldersByParent.get(key) ?? []).map((folder): TreeFolder => ({
      kind: 'folder',
      id: folder.id,
      title: folder.title,
      description: folder.description,
      depth: folder.depth,
      createdBy: folder.createdBy,
      children: childrenOf(folder.id),
    })),
  ]

  return childrenOf(ROOT)
}
