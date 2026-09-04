import type { TreeNode } from '@/lib/folder/buildTree'

/**
 * How many threads and pages sit in a folder, counting everything below it (#32).
 *
 * What hiding a room costs, in a number: setting a folder to `hidden` takes its whole subtree with
 * it, and an operator changing one select sees no sign of that otherwise. Counted here rather than
 * asked of the server, because the forum's tree is already loaded in full.
 */
export function countLeaves(nodes: ReadonlyArray<TreeNode>): {
  threads: number
  pages: number
} {
  let threads = 0
  let pages = 0

  for (const node of nodes) {
    if (node.kind === 'folder') {
      const inside = countLeaves(node.children)
      threads += inside.threads
      pages += inside.pages
    } else if (node.kind === 'thread') {
      threads += 1
    } else {
      pages += 1
    }
  }

  return { threads, pages }
}

/** The folder itself, found anywhere in the tree — the caller has an id, not a node. */
export function findFolder(nodes: ReadonlyArray<TreeNode>, folderId: string): TreeNode | undefined {
  for (const node of nodes) {
    if (node.kind !== 'folder') continue
    if (node.id === folderId) return node

    const found = findFolder(node.children, folderId)
    if (found !== undefined) return found
  }

  return undefined
}
