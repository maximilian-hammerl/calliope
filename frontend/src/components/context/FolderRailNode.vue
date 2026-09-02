<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, ChevronRight } from '@lucide/vue'
import type { TreeNode } from '@/lib/folder/buildTree'
import FavouriteMark from '@/components/favourite/FavouriteMark.vue'

/**
 * One row, and its children under it. Recursive by name — a component may render itself, and the
 * depth is bounded at five by the API.
 */
defineProps<{ node: TreeNode; groupId: string }>()

// Open to start: a member who nested something wants to see it, and the whole tree is small.
const open = ref<boolean>(true)
</script>

<template>
  <RouterLink
    v-if="node.kind !== 'folder'"
    :to="{
      name: node.kind === 'thread' ? 'thread' : 'page',
      params:
        node.kind === 'thread' ? { groupId, threadId: node.id } : { groupId, pageId: node.id },
    }"
    class="flex items-baseline gap-1.5 truncate text-ink-4 hover:text-ink-2"
  >
    <span class="truncate">{{ node.title }}</span>
    <FavouriteMark v-if="node.isFavourite" />
  </RouterLink>

  <div v-else>
    <button
      type="button"
      class="flex w-full items-center gap-1 text-left font-medium text-ink-3 hover:text-ink-1"
      :aria-expanded="open"
      @click="open = !open"
    >
      <component :is="open ? ChevronDown : ChevronRight" :size="12" :stroke-width="1.5" />
      <span class="truncate">{{ node.title }}</span>
    </button>

    <!-- Indented by one step per level rather than by the node's own depth: the rail is 262px
         wide, and five levels of a wider indent leave no room for a title. -->
    <div v-if="open && node.children.length > 0" class="mt-1.5 ml-3 flex flex-col gap-1.5">
      <FolderRailNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :group-id="groupId"
      />
    </div>
  </div>
</template>
