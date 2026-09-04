<script setup lang="ts">
/**
 * The forum's own page: its structure, and where a thread or a page is started. The tree carries
 * the actions here and the rail reads the same rows without them, as a group's does.
 *
 * Folders are not created here — their permissions need a surface of their own (#32's slice 7).
 */
import { computed, provide, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@lucide/vue'
import { useIsOperator } from '@/composables/useIsOperator'
import { useForumTree } from '@/composables/useForumTree'
import FolderTreeNode from '@/components/folder/FolderTreeNode.vue'
import CreateKindItems from '@/components/folder/CreateKindItems.vue'
import ThreadDialog from '@/components/thread/ThreadDialog.vue'
import PageDialog from '@/components/page/PageDialog.vue'
import FolderDialog from '@/components/folder/FolderDialog.vue'
import type { EditableFolder } from '@/components/folder/FolderDialog.vue'
import MoveDialog from '@/components/folder/MoveDialog.vue'
import type { Movable } from '@/components/folder/MoveDialog.vue'
import { countLeaves, findFolder } from '@/lib/folder/countLeaves'
import { useDeleteForumFolder, getListForumFoldersQueryKey } from '@/api/forum/forum'
import { useQueryClient } from '@tanstack/vue-query'
import { exactKeyFilter } from '@/lib/api/queryKeys'
import { failureMessage } from '@/lib/format/failure'
import type { TreeFolder, TreeNode } from '@/lib/folder/buildTree'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { START_FORUM_CREATE } from '@/lib/folder/treeScope'
import type { StartForumCreate, TreeScope } from '@/lib/folder/treeScope'

const { tree } = useForumTree()

const isOperator = useIsOperator()

const router = useRouter()

/** Where it would create. `null` is the root; `undefined` is no dialog, as the group's tree has it. */
const creatingThreadIn = ref<string | null | undefined>(undefined)
const creatingPageIn = ref<string | null | undefined>(undefined)

const threadDialogOpen = computed<boolean>({
  get: () => creatingThreadIn.value !== undefined,
  set: (open) => {
    if (!open) creatingThreadIn.value = undefined
  },
})
const pageDialogOpen = computed<boolean>({
  get: () => creatingPageIn.value !== undefined,
  set: (open) => {
    if (!open) creatingPageIn.value = undefined
  },
})

/**
 * All three at the root, now that slice 7 can make a room: the top level is where a new one
 * belongs, and every room the seed has is there — without this an operator could nest rooms
 * forever and never add one beside „Forenspiele".
 */
function createAtRoot(kind: 'folder' | 'page' | 'thread') {
  if (kind === 'folder') creatingFolderUnder.value = null
  else startCreate(kind, null)
}

const startCreate: StartForumCreate = (kind, folderId) => {
  if (kind === 'thread') creatingThreadIn.value = folderId
  else creatingPageIn.value = folderId
}

// The rows are five levels deep at most and recursive, so this reaches them by injection rather
// than by every level re-emitting.
provide(START_FORUM_CREATE, startCreate)

/** Only an operator may write to the root: nothing above it answers, so its constant does. */
const mayCreateAtRoot = isOperator

/** The dialog says where to go afterwards is the caller's, so this lands on the new writing. */
function openThread(threadId: string) {
  void router.push({ name: 'forumThread', params: { threadId } })
}

function openPage(pageId: string) {
  void router.push({ name: 'forumPage', params: { pageId } })
}

/** Collapsed rather than expanded, so a folder somebody just made is open. */
const collapsed = reactive<Set<string>>(new Set())

function toggle(folderId: string) {
  if (collapsed.has(folderId)) collapsed.delete(folderId)
  else collapsed.add(folderId)
}

/**
 * The first two levels start open and everything below starts shut, or a forum several levels
 * deep opens as a wall of rows. Decided once per folder, as it first appears — so a folder the
 * member opened stays open across a refetch, which re-deriving it would undo.
 */
const decided = new Set<string>()

function collapseBelowLevelTwo(nodes: ReadonlyArray<TreeNode>): void {
  for (const node of nodes) {
    if (node.kind !== 'folder') continue

    if (!decided.has(node.id)) {
      decided.add(node.id)
      if (node.depth > 2) collapsed.add(node.id)
    }

    collapseBelowLevelTwo(node.children)
  }
}

const queryClient = useQueryClient()

/**
 * The forum's structure, which the tree emits and this view owns — as `FolderTree` owns a group's.
 * Five levels of rows do not each mount their own dialog.
 */
const creatingFolderUnder = ref<string | null | undefined>(undefined)
const editingFolder = ref<EditableFolder | undefined>(undefined)
const moving = ref<Movable | undefined>(undefined)

const folderDialogOpen = computed<boolean>({
  get: () => creatingFolderUnder.value !== undefined || editingFolder.value !== undefined,
  set: (open) => {
    if (!open) {
      creatingFolderUnder.value = undefined
      editingFolder.value = undefined
    }
  },
})

const moveDialogOpen = computed<boolean>({
  get: () => moving.value !== undefined,
  set: (open) => {
    if (!open) moving.value = undefined
  },
})

/**
 * The row's own setting travels into the dialog, not the reduced one: what an operator chose is
 * what they should see when they open it again, even where a folder above has closed it.
 */
function editFolder(folder: TreeFolder) {
  editingFolder.value = {
    id: folder.id,
    title: folder.title,
    description: folder.description,
    memberPermission: folder.memberPermission,
  }
}

/** What the folder being edited holds, for the dialog's warning. The tree is already loaded. */
const holds = computed<{ threads: number; pages: number } | undefined>(() => {
  const id = editingFolder.value?.id
  if (id === undefined) return undefined

  const folder = findFolder(nodes.value, id)
  return folder?.kind === 'folder' ? countLeaves(folder.children) : undefined
})

/** The dialog needs where the thing sits now, which a folder's node does not carry. */
function movableOf(node: TreeNode): Movable {
  return {
    kind: node.kind,
    id: node.id,
    title: node.title,
    parentId: node.kind === 'folder' ? parentOf(node.id) : node.folderId,
  }
}

/** A folder's own parent is not on its node, so it is read back out of the tree. */
function parentOf(folderId: string): string | null {
  const walk = (list: TreeNode[], parent: string | null): string | null | undefined => {
    for (const node of list) {
      if (node.kind !== 'folder') continue
      if (node.id === folderId) return parent

      const found = walk(node.children, node.id)
      if (found !== undefined) return found
    }
    return undefined
  }
  return walk(nodes.value, null) ?? null
}

const deleteError = ref<string | undefined>(undefined)
const { mutateAsync: deleteFolder } = useDeleteForumFolder()

/** No confirmation: only an empty folder offers it, so there is nothing to lose by pressing it. */
async function removeFolder(folder: TreeFolder) {
  deleteError.value = undefined
  try {
    await deleteFolder({ folderId: folder.id })
  } catch (error) {
    deleteError.value = failureMessage(
      error,
      `„${folder.title}" konnte nicht gelöscht werden. Inzwischen liegt vielleicht etwas darin.`,
    )
    return
  }
  await queryClient.invalidateQueries(exactKeyFilter(getListForumFoldersQueryKey()))
}

const nodes = computed<TreeNode[]>(() => tree.value)
const scope = computed<TreeScope>(() => ({
  kind: 'forum',
  isOperator: isOperator.value,
}))

watch(nodes, collapseBelowLevelTwo, { immediate: true })
</script>

<template>
  <div class="flex-1 overflow-auto px-gutter pt-7 pb-8 md:px-10">
    <div class="reading-column">
      <div class="mb-1.5 flex items-baseline gap-2">
        <h1 class="text-h1 text-ink-1">Forum</h1>

        <DropdownMenu v-if="mayCreateAtRoot">
          <DropdownMenuTrigger
            class="flex min-h-11 items-center gap-1 text-note text-ink-5 hover:text-ink-2 md:min-h-0"
          >
            <Plus :size="14" :stroke-width="1.5" aria-hidden="true" />
            Anlegen
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <CreateKindItems @choose="createAtRoot" />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p class="mb-7 text-body text-ink-4">
        Hier wird öffentlich geschrieben. Was in einer Schreibgruppe entsteht, bleibt dort.
      </p>

      <Alert v-if="deleteError" variant="destructive" role="alert" class="mb-3.5">
        <AlertDescription>{{ deleteError }}</AlertDescription>
      </Alert>

      <p v-if="nodes.length === 0" class="text-body text-ink-4">Noch nichts angelegt.</p>

      <!-- The page's own row, not the rail's: the rail's is tuned for 262px, which on a page
           reads as too quiet and too shallowly indented. -->
      <ul v-else>
        <FolderTreeNode
          v-for="node in nodes"
          :key="node.id"
          :node="node"
          :scope="scope"
          :collapsed="collapsed"
          @toggle="toggle"
          @add-folder="creatingFolderUnder = $event"
          @add-page="creatingPageIn = $event"
          @add-thread="creatingThreadIn = $event"
          @edit="editFolder"
          @move="moving = movableOf($event)"
          @remove="removeFolder"
        />
      </ul>
    </div>
  </div>

  <FolderDialog
    v-model:open="folderDialogOpen"
    :scope="{ kind: 'forum' }"
    :folder="editingFolder"
    :parent-folder-id="creatingFolderUnder ?? null"
    :holds="holds"
  />

  <MoveDialog
    v-model:open="moveDialogOpen"
    :scope="{ kind: 'forum' }"
    :tree="nodes"
    :item="moving"
  />

  <ThreadDialog
    v-model:open="threadDialogOpen"
    :scope="{ kind: 'forum' }"
    :folder-id="creatingThreadIn ?? undefined"
    @created="openThread"
  />

  <PageDialog
    v-model:open="pageDialogOpen"
    :scope="{ kind: 'forum' }"
    :folder-id="creatingPageIn ?? undefined"
    @created="openPage"
  />
</template>
