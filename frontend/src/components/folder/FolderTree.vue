<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { Plus } from '@lucide/vue'
import { getListFoldersQueryKey, useDeleteFolder } from '@/api/folders/folders'
import { failureMessage } from '@/lib/format/failure'
import { useFolderTree } from '@/composables/useFolderTree'
import type { TreeFolder, TreeNode } from '@/lib/folder/buildTree'
import FolderTreeNode from '@/components/folder/FolderTreeNode.vue'
import CreateKindItems from '@/components/folder/CreateKindItems.vue'
import FolderDialog from '@/components/folder/FolderDialog.vue'
import MoveDialog from '@/components/folder/MoveDialog.vue'
import type { Movable } from '@/components/folder/MoveDialog.vue'
import type { EditableFolder } from '@/components/folder/FolderDialog.vue'
import PageDialog from '@/components/page/PageDialog.vue'
import ThreadDialog from '@/components/thread/ThreadDialog.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * The group's structure, where it is changed. The only editable copy: the rails elsewhere read
 * the same tree without actions, so there is one place to look for what changes it.
 *
 * The dialogs and the delete live here rather than in the rows, so five levels of rows do not
 * each mount their own.
 */
const props = defineProps<{
  groupId: string
  mayWrite: boolean
  mayAdminister: boolean
  currentUserId?: string
}>()

const router = useRouter()
const queryClient = useQueryClient()

const { tree } = useFolderTree(computed<string>(() => props.groupId))

/** Collapsed rather than expanded, so a folder somebody just made is open. */
const collapsed = reactive<Set<string>>(new Set())

function toggle(folderId: string) {
  if (collapsed.has(folderId)) collapsed.delete(folderId)
  else collapsed.add(folderId)
}

/** Which dialog is open, and where it would create. Null means the root. */
const creatingFolderUnder = ref<string | null | undefined>(undefined)
const creatingPageUnder = ref<string | null | undefined>(undefined)
const creatingThreadUnder = ref<string | null | undefined>(undefined)
const editing = ref<EditableFolder | undefined>(undefined)

const folderDialogOpen = computed<boolean>({
  get: () => creatingFolderUnder.value !== undefined || editing.value !== undefined,
  set: (open) => {
    if (!open) {
      creatingFolderUnder.value = undefined
      editing.value = undefined
    }
  },
})

const pageDialogOpen = computed<boolean>({
  get: () => creatingPageUnder.value !== undefined,
  set: (open) => {
    if (!open) creatingPageUnder.value = undefined
  },
})

const threadDialogOpen = computed<boolean>({
  get: () => creatingThreadUnder.value !== undefined,
  set: (open) => {
    if (!open) creatingThreadUnder.value = undefined
  },
})

function createAtRoot(kind: 'folder' | 'page' | 'thread') {
  if (kind === 'folder') creatingFolderUnder.value = null
  else if (kind === 'page') creatingPageUnder.value = null
  else creatingThreadUnder.value = null
}

/** What the move dialog is working on, which is also what opens it. */
const moving = ref<Movable | undefined>(undefined)

const moveDialogOpen = computed<boolean>({
  get: () => moving.value !== undefined,
  set: (open) => {
    if (!open) moving.value = undefined
  },
})

function startMove(node: TreeNode) {
  moving.value = {
    kind: node.kind,
    id: node.id,
    title: node.title,
    parentId: node.kind === 'folder' ? parentOf(node.id) : node.folderId,
  }
}

/** A folder's own parent is not on its node, so it is read back out of the tree. */
function parentOf(folderId: string): string | null {
  const walk = (nodes: TreeNode[], parent: string | null): string | null | undefined => {
    for (const node of nodes) {
      if (node.kind !== 'folder') continue
      if (node.id === folderId) return parent
      const found = walk(node.children, node.id)
      if (found !== undefined) return found
    }
    return undefined
  }
  return walk(tree.value, null) ?? null
}

const deleteError = ref<string | undefined>(undefined)
const { mutateAsync: deleteFolder } = useDeleteFolder()

/**
 * No confirmation: only an empty folder offers this, so there is nothing to lose by pressing it.
 * The 409 is still handled — somebody else may have put something in it a moment ago.
 */
async function remove(folder: TreeFolder) {
  deleteError.value = undefined
  try {
    await deleteFolder({ groupId: props.groupId, folderId: folder.id })
  } catch (error) {
    deleteError.value = failureMessage(
      error,
      `„${folder.title}" konnte nicht gelöscht werden. Inzwischen liegt vielleicht etwas darin.`,
    )
    return
  }
  await queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey(props.groupId) })
}

function openThread(threadId: string) {
  void router.push({ name: 'thread', params: { groupId: props.groupId, threadId } })
}

function openPage(pageId: string) {
  void router.push({ name: 'page', params: { groupId: props.groupId, pageId } })
}

const nodes = computed<TreeNode[]>(() => tree.value)
</script>

<template>
  <section>
    <h3 class="mb-3 text-h3 text-ink-1">Inhalt</h3>

    <Alert v-if="deleteError" variant="destructive" role="alert" class="mb-3">
      <AlertDescription>{{ deleteError }}</AlertDescription>
    </Alert>

    <p v-if="nodes.length === 0" class="text-body text-ink-4">
      Noch nichts angelegt.
      <template v-if="mayWrite">Leg ein Thema, eine Seite oder einen Ordner an.</template>
    </p>

    <!-- A real list, so the nesting is in the markup: it is the whole point of the feature, and
         indentation alone conveys it to nobody using a screen reader. -->
    <ul v-else>
      <FolderTreeNode
        v-for="node in nodes"
        :key="node.id"
        :node="node"
        :scope="{ kind: 'group', groupId }"
        :may-write="mayWrite"
        :collapsed="collapsed"
        @toggle="toggle"
        @add-folder="creatingFolderUnder = $event"
        @add-page="creatingPageUnder = $event"
        @add-thread="creatingThreadUnder = $event"
        @edit="editing = $event"
        @move="startMove"
        @remove="remove"
      />
    </ul>

    <!-- The root's own action, in the same shape a folder row offers. -->
    <DropdownMenu v-if="mayWrite">
      <DropdownMenuTrigger
        class="mt-3 flex min-h-11 items-center gap-1 rounded-lg border border-line-5 bg-paper-3 px-2.5 text-[12.5px] font-medium text-oak-deep md:min-h-0 md:py-[5px]"
        aria-label="Auf oberster Ebene anlegen"
      >
        <Plus :size="14" :stroke-width="1.5" />
        Anlegen
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <CreateKindItems @choose="createAtRoot" />
      </DropdownMenuContent>
    </DropdownMenu>

    <MoveDialog
      v-model:open="moveDialogOpen"
      :scope="{ kind: 'group', groupId }"
      :tree="nodes"
      :item="moving"
    />
    <FolderDialog
      v-model:open="folderDialogOpen"
      :scope="{ kind: 'group', groupId }"
      :folder="editing"
      :parent-folder-id="creatingFolderUnder ?? null"
    />
    <PageDialog
      v-model:open="pageDialogOpen"
      :scope="{ kind: 'group', groupId }"
      :folder-id="creatingPageUnder ?? undefined"
      @created="openPage"
    />
    <ThreadDialog
      v-model:open="threadDialogOpen"
      :scope="{ kind: 'group', groupId }"
      :folder-id="creatingThreadUnder ?? undefined"
      @created="openThread"
    />
  </section>
</template>
