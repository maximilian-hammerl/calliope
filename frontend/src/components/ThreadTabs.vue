<script setup lang="ts">
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
    class="sticky top-0 z-[2] bg-paper-1 px-[18px] pt-[15px] shadow-[0_1px_0_var(--color-line-3)] md:px-10"
  >
    <div
      class="scroll-x-hidden flex items-baseline gap-5 text-[13.5px] leading-[1.2] whitespace-nowrap"
    >
      <RouterLink
        v-for="thread in threads"
        :key="thread.id"
        :to="{ name: 'thread', params: { groupId, threadId: thread.id } }"
        class="flex-none border-b-2 pb-[11px]"
        :class="
          thread.id === activeId
            ? 'border-oak font-medium text-ink-1'
            : 'border-transparent text-ink-5'
        "
      >
        {{ thread.title }}
      </RouterLink>

      <button
        v-if="mayWrite"
        type="button"
        class="flex-none border-b-2 border-transparent pb-[11px] text-ink-5"
        @click="$emit('create')"
      >
        ＋ Thread
      </button>
    </div>
  </div>
</template>
