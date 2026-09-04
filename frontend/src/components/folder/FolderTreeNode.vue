<script setup lang="ts">
import { computed, inject } from 'vue'
import { FolderInput, Pencil, Plus, Trash2 } from '@lucide/vue'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import type { TreeFolder, TreeNode } from '@/lib/folder/buildTree'
import FavouriteMark from '@/components/favourite/FavouriteMark.vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import CreateKindItems from '@/components/folder/CreateKindItems.vue'
import ForumPermissionMark from '@/components/forum/ForumPermissionMark.vue'
import { leafRoute, START_FORUM_CREATE } from '@/lib/folder/treeScope'
import type { TreeScope } from '@/lib/folder/treeScope'
import { mayWriteInForum } from '@/lib/forum/permission'

/**
 * One row of a tree on its own page — a group's or the forum's — and its children under it.
 * Recursive by name; the depth is bounded at five by the API.
 *
 * The row acts, but owns no dialog and no mutation: the tree above holds those, so five levels
 * of rows do not each mount their own copy.
 *
 * Each scope's actions are gated by that scope's own rule: a group's by `mayWrite`, the forum's
 * by the folder's permission and by whether a create handler was provided at all.
 */
const props = defineProps<{
  node: TreeNode
  scope: TreeScope
  /** A group's answer for the whole tree. The forum asks each folder instead. */
  mayWrite?: boolean
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

/**
 * Who may reshape the tree: a group's writers, and the forum's operators — it has no
 * administrators, so its structure is theirs alone (#32).
 */
const mayChangeStructure = computed<boolean>(() =>
  props.scope.kind === 'group' ? props.mayWrite === true : props.scope.isOperator,
)

/**
 * A room reads as a section at the top and as a row further in — the same fall-off a heading
 * scale has, which is what stops a folder at level four looking like a page title.
 */
const titleClass = computed<string>(() =>
  folder.value?.depth === 1 ? 'text-h3 text-ink-1' : 'text-body font-medium text-ink-2',
)

/**
 * Space above a room, not between the things in one: that is what opens a section. On the `li`,
 * where `first:` means the first row of the tree — on the row itself it is always its `li`'s first
 * child, so the reset cancelled the margin everywhere.
 */
const spacing = computed<string>(() => {
  if (folder.value === undefined) return ''
  return folder.value.depth === 1 ? 'mt-6 first:mt-0' : 'mt-4'
})

const startForumCreate = inject(START_FORUM_CREATE, undefined)

/**
 * A *member* with `write` in this folder, offered threads and pages. An operator's create is the
 * structure menu below instead, which also offers a folder — two „+" on one row would be the same
 * button twice, and only one of them could make a room.
 */
const mayCreateHere = computed<boolean>(() => {
  if (startForumCreate === undefined || folder.value === undefined) return false
  if (props.scope.kind !== 'forum' || props.scope.isOperator) return false
  return mayWriteInForum(folder.value.effectiveMemberPermission, false)
})
</script>

<template>
  <li :class="spacing">
    <div v-if="node.kind !== 'folder'" class="flex items-center gap-2">
      <RouterLink
        :to="leafRoute(scope, node)"
        class="flex min-h-11 min-w-0 items-center gap-2 text-body text-ink-3 hover:text-ink-1 md:min-h-0 md:py-[3px]"
      >
        <span class="truncate">{{ node.title }}</span>
        <FavouriteMark v-if="node.isFavourite" />
        <span class="text-[11.5px] text-ink-6">
          {{ node.kind === 'thread' ? 'Thema' : 'Seite' }}
        </span>
        <ForumPermissionMark
          v-if="scope.kind === 'forum' && scope.isOperator && node.effectiveMemberPermission"
          :permission="node.effectiveMemberPermission"
        />
      </RouterLink>

      <button
        v-if="mayChangeStructure"
        type="button"
        class="ml-auto flex min-h-11 shrink-0 items-center px-1 text-ink-5 hover:text-oak-deep md:min-h-0"
        aria-label="Verschieben"
        @click="emit('move', node)"
      >
        <FolderInput :size="14" :stroke-width="1.5" />
      </button>
    </div>

    <!--
      The house disclosure rather than a hand-rolled one: the chevron rule, the open/close
      animation and the `aria-controls` the trigger claims all come with it. One accordion per
      folder, driven by the tree's own `collapsed` set, so the state stays where it was.
    -->
    <Accordion
      v-else-if="folder"
      type="multiple"
      as="div"
      :model-value="collapsed.has(folder.id) ? [] : [folder.id]"
      @update:model-value="emit('toggle', folder!.id)"
    >
      <AccordionItem :value="folder.id" class="border-b-0">
        <div class="flex items-center gap-2">
          <AccordionTrigger
            :class="[
              'min-h-11 flex-row-reverse items-center justify-end gap-1.5 py-0 hover:no-underline md:min-h-0 [&_svg]:size-3.5 [&_svg]:translate-y-0',
              titleClass,
            ]"
          >
            <span class="flex min-w-0 items-center gap-1.5">
              <span class="truncate">{{ folder.title }}</span>
              <ForumPermissionMark
                v-if="
                  scope.kind === 'forum' && scope.isOperator && folder.effectiveMemberPermission
                "
                :permission="folder.effectiveMemberPermission"
              />
            </span>
          </AccordionTrigger>

          <DropdownMenu v-if="mayCreateHere">
            <DropdownMenuTrigger
              class="ml-auto flex min-h-11 shrink-0 items-center px-1 text-ink-5 hover:text-oak-deep md:min-h-0"
              :aria-label="`In ${folder.title} anlegen`"
            >
              <Plus :size="14" :stroke-width="1.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <CreateKindItems
                :only="['thread', 'page']"
                @choose="(kind) => kind !== 'folder' && startForumCreate?.(kind, folder!.id)"
              />
            </DropdownMenuContent>
          </DropdownMenu>

          <div
            v-if="mayChangeStructure"
            class="ml-auto flex shrink-0 items-center gap-1 text-ink-5"
          >
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
              type="button"
              class="flex min-h-11 items-center px-1 hover:text-oak-deep md:min-h-0"
              aria-label="Ordner bearbeiten"
              @click="emit('edit', folder)"
            >
              <Pencil :size="14" :stroke-width="1.5" />
            </button>

            <button
              type="button"
              class="flex min-h-11 items-center px-1 hover:text-oak-deep md:min-h-0"
              aria-label="Ordner verschieben"
              @click="emit('move', folder)"
            >
              <FolderInput :size="14" :stroke-width="1.5" />
            </button>

            <!-- Hidden rather than disabled once it holds something: the reason is the content,
               which is on screen right under it. -->
            <!-- `mayChangeStructure`, not the group's own `mayWrite`: the forum passes no such
                 prop, so asking it left an operator with no way to delete a room at all. -->
            <button
              v-if="mayChangeStructure && isEmpty"
              type="button"
              class="flex min-h-11 items-center px-1 hover:text-oak-deep md:min-h-0"
              aria-label="Ordner löschen"
              @click="emit('remove', folder)"
            >
              <Trash2 :size="14" :stroke-width="1.5" />
            </button>
          </div>
        </div>

        <!-- Tight under its title and outside the rule below, which is what makes it read as part
           of the heading rather than as the first thing in the folder. Clamped and measured as a
           group's synopsis is: nothing stops a description running to five lines. -->
        <p
          v-if="folder.description"
          class="ml-[19px] line-clamp-2 max-w-[60ch] text-row text-ink-4"
        >
          {{ folder.description }}
        </p>

        <!-- A hairline the contents hang from, descending under the chevron: it separates them from
           the description above and shows the nesting without spending more indent on it. The
           border and padding carry what `ml-[19px]` carried, so the depth budget is unchanged. -->
        <AccordionContent class="pt-0 pb-0">
          <ul class="mt-3 ml-[7px] border-l border-line-2 pl-3">
            <FolderTreeNode
              v-for="child in folder.children"
              :key="child.id"
              :node="child"
              :scope="scope"
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
          </ul>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </li>
</template>
