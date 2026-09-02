<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, ChevronRight, FolderInput, Pencil, Plus, Trash2 } from '@lucide/vue'
import type { TreeFolder, TreeNode } from '@/lib/folder/buildTree'
import FavouriteMark from '@/components/favourite/FavouriteMark.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import CreateKindItems from '@/components/folder/CreateKindItems.vue'

/**
 * One row of the group's own tree, and its children under it. Recursive by name; the depth is
 * bounded at five by the API.
 *
 * The row acts, but owns no dialog and no mutation: the tree above holds those, so five levels
 * of rows do not each mount their own copy.
 */
const props = defineProps<{
  node: TreeNode
  groupId: string
  mayWrite: boolean
  /** Which folders are collapsed, owned by the tree so the state survives a re-render. */
  collapsed: Set<string>
}>()

const emit = defineEmits<{
  toggle: [folderId: string]
  addFolder: [parentFolderId: string]
  addPage: [folderId: string]
  addThread: [folderId: string]
  edit: [folder: TreeFolder]
  move: [node: TreeNode]
  remove: [folder: TreeFolder]
}>()

const folder = computed<TreeFolder | undefined>(() =>
  props.node.kind === 'folder' ? props.node : undefined,
)

function createIn(folderId: string, kind: 'folder' | 'page' | 'thread') {
  if (kind === 'folder') emit('addFolder', folderId)
  else if (kind === 'page') emit('addPage', folderId)
  else emit('addThread', folderId)
}

/** Only an empty folder goes, so a full one does not offer it at all. */
const isEmpty = computed<boolean>(() => (folder.value?.children.length ?? 0) === 0)
</script>

<template>
  <div>
    <div v-if="node.kind !== 'folder'" class="flex min-h-11 items-center gap-2 md:min-h-0">
      <RouterLink
        :to="{
          name: node.kind === 'thread' ? 'thread' : 'page',
          params:
            node.kind === 'thread' ? { groupId, threadId: node.id } : { groupId, pageId: node.id },
        }"
        class="flex min-w-0 items-center gap-2 text-body text-ink-3 hover:text-ink-1 md:py-[3px]"
      >
        <span class="truncate">{{ node.title }}</span>
        <FavouriteMark v-if="node.isFavourite" />
        <span class="text-[11.5px] text-ink-6">
          {{ node.kind === 'thread' ? 'Thema' : 'Seite' }}
        </span>
      </RouterLink>

      <button
        v-if="mayWrite"
        type="button"
        class="ml-auto flex min-h-11 shrink-0 items-center px-1 text-ink-5 hover:text-oak-deep md:min-h-0"
        aria-label="Verschieben"
        @click="emit('move', node)"
      >
        <FolderInput :size="14" :stroke-width="1.5" />
      </button>
    </div>

    <template v-else-if="folder">
      <div class="flex min-h-11 items-center gap-2 md:min-h-0 md:py-[3px]">
        <button
          type="button"
          class="flex min-w-0 items-center gap-1 text-left text-body font-medium text-ink-2 hover:text-ink-1"
          :aria-expanded="!collapsed.has(folder.id)"
          @click="emit('toggle', folder.id)"
        >
          <component
            :is="collapsed.has(folder.id) ? ChevronRight : ChevronDown"
            :size="14"
            :stroke-width="1.5"
          />
          <span class="truncate">{{ folder.title }}</span>
        </button>

        <div v-if="mayWrite" class="ml-auto flex shrink-0 items-center gap-1 text-ink-5">
          <DropdownMenu>
            <DropdownMenuTrigger
              class="flex min-h-11 items-center px-1 hover:text-oak-deep md:min-h-0"
              aria-label="In diesem Ordner anlegen"
            >
              <Plus :size="14" :stroke-width="1.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <CreateKindItems @choose="createIn(folder.id, $event)" />
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            v-if="mayWrite"
            type="button"
            class="flex min-h-11 items-center px-1 hover:text-oak-deep md:min-h-0"
            aria-label="Ordner bearbeiten"
            @click="emit('edit', folder)"
          >
            <Pencil :size="14" :stroke-width="1.5" />
          </button>

          <button
            v-if="mayWrite"
            type="button"
            class="flex min-h-11 items-center px-1 hover:text-oak-deep md:min-h-0"
            aria-label="Ordner verschieben"
            @click="emit('move', folder)"
          >
            <FolderInput :size="14" :stroke-width="1.5" />
          </button>

          <!-- Hidden rather than disabled once it holds something: the reason is the content,
               which is on screen right under it. -->
          <button
            v-if="mayWrite && isEmpty"
            type="button"
            class="flex min-h-11 items-center px-1 hover:text-oak-deep md:min-h-0"
            aria-label="Ordner löschen"
            @click="emit('remove', folder)"
          >
            <Trash2 :size="14" :stroke-width="1.5" />
          </button>
        </div>
      </div>

      <p v-if="folder.description" class="ml-[19px] max-w-[60ch] text-note text-ink-5">
        {{ folder.description }}
      </p>

      <div v-if="!collapsed.has(folder.id)" class="ml-[19px]">
        <FolderTreeNode
          v-for="child in folder.children"
          :key="child.id"
          :node="child"
          :group-id="groupId"
          :may-write="mayWrite"
          :collapsed="collapsed"
          @toggle="emit('toggle', $event)"
          @add-folder="emit('addFolder', $event)"
          @add-page="emit('addPage', $event)"
          @add-thread="emit('addThread', $event)"
          @edit="emit('edit', $event)"
          @move="emit('move', $event)"
          @remove="emit('remove', $event)"
        />
      </div>
    </template>
  </div>
</template>
