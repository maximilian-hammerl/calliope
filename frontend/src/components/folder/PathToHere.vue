<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import type { TreeNode } from '@/lib/folder/buildTree'
import { pathToFolder } from '@/lib/folder/pathToFolder'

/**
 * Where a thread or a page sits, above its title. The tab strip used to say this by being the
 * only way in; with a tree it has to be said out loud.
 *
 * Only the root is a link: a folder has no view of its own, and inventing one for a breadcrumb
 * would be the tail wagging the dog. The rest is orientation, which is what it is for.
 *
 * The tree arrives as a prop rather than being fetched here, because a group and the public
 * forum both have one (#32) and this component should not have to know which it is looking at.
 */
const props = defineProps<{
  tree: TreeNode[]
  rootTitle: string
  rootTo: RouteLocationRaw
  /** Null for something at the root, which then shows the root alone. */
  folderId: string | null
}>()

const folders = computed<string[]>(() =>
  props.folderId === null ? [] : pathToFolder(props.tree, props.folderId),
)
</script>

<template>
  <nav class="mb-1.5 flex flex-wrap items-center gap-1 text-[12.5px] text-ink-5" aria-label="Pfad">
    <RouterLink :to="rootTo" class="truncate hover:text-ink-2">{{ rootTitle }}</RouterLink>

    <template v-for="folder in folders" :key="folder">
      <ChevronRight :size="12" :stroke-width="1.5" class="shrink-0 text-ink-6" />
      <span class="truncate">{{ folder }}</span>
    </template>
  </nav>
</template>
