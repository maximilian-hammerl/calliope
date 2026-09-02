import type { TreeNode } from '@/lib/folder/buildTree'

/**
 * The titles of the folders from the root down to `folderId`, for a breadcrumb.
 *
 * Empty when the folder is not in the tree — which happens for a moment after somebody else
 * moves or deletes it, and is better than a path that names a folder no longer there.
 */
export function pathToFolder(tree: TreeNode[], folderId: string): string[] {
  const walk = (nodes: TreeNode[], above: string[]): string[] | undefined => {
    for (const node of nodes) {
      if (node.kind !== 'folder') continue
      const here = [...above, node.title]
      if (node.id === folderId) return here
      const found = walk(node.children, here)
      if (found !== undefined) return found
    }
    return undefined
  }

  return walk(tree, []) ?? []
}
