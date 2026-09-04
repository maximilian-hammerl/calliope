import { computed } from 'vue'
import { useListForumFolders, useListForumPages, useListForumThreads } from '@/api/forum/forum'
import { buildTree } from '@/lib/folder/buildTree'
import type { TreeNode } from '@/lib/folder/buildTree'

/**
 * The forum's three lists as one tree, through the same `buildTree` a group uses. What the API
 * leaves out is what a member may not see (#32).
 */
export function useForumTree() {
  const { data: foldersData } = useListForumFolders()
  const { data: pagesData } = useListForumPages()
  const { data: threadsData } = useListForumThreads()

  const tree = computed<TreeNode[]>(() =>
    buildTree(
      foldersData.value?.status === 200 ? foldersData.value.data.results : [],
      pagesData.value?.status === 200 ? pagesData.value.data.results : [],
      threadsData.value?.status === 200 ? threadsData.value.data.results : [],
    ),
  )

  return { tree }
}
