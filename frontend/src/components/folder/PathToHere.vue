<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { useFolderTree } from '@/composables/useFolderTree'
import { pathToFolder } from '@/lib/folder/pathToFolder'

/**
 * Where a thread or a page sits, above its title. The tab strip used to say this by being the
 * only way in; with a tree it has to be said out loud.
 *
 * Only the group is a link: a folder has no view of its own, and inventing one for a breadcrumb
 * would be the tail wagging the dog. The rest is orientation, which is what it is for.
 */
const props = defineProps<{
  groupId: string
  groupTitle: string
  /** Null for something at the root, which then shows the group alone. */
  folderId: string | null
}>()

const { tree } = useFolderTree(computed<string>(() => props.groupId))

const folders = computed<string[]>(() =>
  props.folderId === null ? [] : pathToFolder(tree.value, props.folderId),
)
</script>

<template>
  <nav class="mb-1.5 flex flex-wrap items-center gap-1 text-[12.5px] text-ink-5" aria-label="Pfad">
    <RouterLink :to="{ name: 'group', params: { groupId } }" class="truncate hover:text-ink-2">
      {{ groupTitle }}
    </RouterLink>

    <template v-for="folder in folders" :key="folder">
      <ChevronRight :size="12" :stroke-width="1.5" class="shrink-0 text-ink-6" />
      <span class="truncate">{{ folder }}</span>
    </template>
  </nav>
</template>
