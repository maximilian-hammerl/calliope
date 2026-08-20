<script setup lang="ts">
import { Plus } from '@lucide/vue'
import type { ListThreads200ResultsItem } from '@/api/models'

defineProps<{
  groupId: string
  threads: ListThreads200ResultsItem[]
  activeId?: string
  mayWrite: boolean
}>()
defineEmits<{ create: [] }>()
</script>

<template>
  <!-- Threads live in tabs, so they appear nowhere else. Sticky under the group title, on
       solid paper so the posts never show through it. -->
  <div
    class="sticky top-0 z-[2] bg-paper-1 px-[18px] shadow-[0_1px_0_var(--color-line-3)] md:px-10 md:pt-[15px]"
  >
    <div
      class="reading-column scroll-x-hidden flex items-baseline gap-5 text-[13.5px] leading-[1.2] whitespace-nowrap"
    >
      <RouterLink
        v-for="thread in threads"
        :key="thread.id"
        :to="{ name: 'thread', params: { groupId, threadId: thread.id } }"
        class="flex min-h-11 flex-none items-end pb-[11px] md:min-h-0"
        :class="
          thread.id === activeId
            ? 'border-b-2 border-oak font-medium text-ink-1'
            : 'border-b-[1.5px] border-line-5 text-ink-5 hover:text-ink-2'
        "
      >
        {{ thread.title }}
      </RouterLink>

      <button
        v-if="mayWrite"
        type="button"
        class="flex min-h-11 flex-none items-end gap-[4px] border-b-2 border-transparent pb-[11px] text-ink-5 hover:text-oak-deep md:min-h-0 md:items-center"
        aria-label="Thread anlegen"
        @click="$emit('create')"
      >
        <Plus :size="14" :stroke-width="1.5" />
        Thread
      </button>
    </div>
  </div>
</template>
