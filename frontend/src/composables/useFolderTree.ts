import { computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useListFolders } from '@/api/folders/folders'
import { useListPages } from '@/api/pages/pages'
import { useListThreads } from '@/api/threads/threads'
import { buildTree } from '@/lib/folder/buildTree'
import type { TreeNode } from '@/lib/folder/buildTree'

/** The group's three lists, assembled into the one tree every view of it renders. */
export function useFolderTree(groupId: Ref<string> | ComputedRef<string>) {
  const { data: foldersData } = useListFolders(groupId)
  const { data: pagesData } = useListPages(groupId)
  const { data: threadsData } = useListThreads(groupId)

  const tree = computed<TreeNode[]>(() =>
    buildTree(
      foldersData.value?.status === 200 ? foldersData.value.data.results : [],
      pagesData.value?.status === 200 ? pagesData.value.data.results : [],
      threadsData.value?.status === 200 ? threadsData.value.data.results : [],
    ),
  )

  return { tree }
}
