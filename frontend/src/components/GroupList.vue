<script setup lang="ts">
import type { ListGroups200ResultsItem } from '@/api/models'

defineProps<{ groups: ListGroups200ResultsItem[]; activeId?: string }>()
defineEmits<{ create: [] }>()
</script>

<template>
  <div class="flex flex-col gap-[2px]">
    <!-- An active row is raised paper with a hairline, never a filled chip. -->
    <RouterLink
      v-for="group in groups"
      :key="group.id"
      :to="{ name: 'group', params: { groupId: group.id } }"
      class="flex min-h-[34px] items-baseline gap-2 rounded-lg border px-[10px] py-[9px] text-[13px] leading-[1.3]"
      :class="
        group.id === activeId
          ? 'border-line-5 bg-paper-0 font-semibold text-ink-1'
          : 'border-transparent text-ink-4'
      "
    >
      {{ group.title }}
    </RouterLink>

    <p v-if="groups.length === 0" class="px-[10px] py-[9px] text-[11.5px] text-ink-5">
      Du bist noch in keiner Gruppe.
    </p>

    <button
      type="button"
      class="mt-2 rounded-lg border border-line-5 bg-paper-3 px-[10px] py-[9px] text-center text-[12.5px] font-medium text-oak-deep hover:bg-paper-4"
      @click="$emit('create')"
    >
      ＋ Gruppe gründen
    </button>
  </div>
</template>
