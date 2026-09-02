import type { TreeFolder, TreeNode } from '@/lib/folder/buildTree'

export type MoveTarget = {
  /** Null is the root of the group's tree. */
  id: string | null
  title: string
  /** 0 for the root, then one step per level, so the picker can indent. */
  level: number
}

/**
 * Every place a thing can go, flattened in the order the tree reads.
 *
 * `excludeSubtreeOf` drops a folder and everything inside it, which is how a folder is stopped
 * from moving into itself. That check is here rather than left to the API because the tree
 * already knows the answer — unlike the depth limit, which only the server knows and which the
 * dialog reports when it refuses.
 */
export function moveTargets(tree: TreeNode[], excludeSubtreeOf?: string): MoveTarget[] {
  const targets: MoveTarget[] = [{ id: null, title: 'Oberste Ebene', level: 0 }]

  const walk = (nodes: TreeNode[], level: number) => {
    for (const node of nodes) {
      if (node.kind !== 'folder') continue
      if (node.id === excludeSubtreeOf) continue
      targets.push({ id: node.id, title: node.title, level })
      walk((node as TreeFolder).children, level + 1)
    }
  }

  walk(tree, 1)
  return targets
}
