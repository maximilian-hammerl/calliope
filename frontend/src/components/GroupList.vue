<script setup lang="ts">
import { Plus } from '@lucide/vue'
import type { ListGroups200ResultsItem } from '@/api/models'

defineProps<{ groups: ListGroups200ResultsItem[]; activeId?: string }>()
defineEmits<{ create: [] }>()
</script>

<template>
  <div class="flex flex-col">
    <!-- The thread tab strip turned on its side: one continuous rule down the left, the
         active segment in oak. No box and no fill — the mark is the rule, as it is for tabs.
         The rows sit flush so the rule is unbroken, which is also what says they are a set. -->
    <RouterLink
      v-for="group in groups"
      :key="group.id"
      :to="{ name: 'group', params: { groupId: group.id } }"
      class="flex min-h-[34px] items-center border-l-2 py-[7px] pl-[11px] text-[13px] leading-[1.3]"
      :class="
        group.id === activeId
          ? 'border-oak font-medium text-ink-1'
          : 'border-line-4 text-ink-4 hover:border-line-5 hover:text-ink-1'
      "
    >
      {{ group.title }}
    </RouterLink>

    <p
      v-if="groups.length === 0"
      class="border-l-2 border-transparent py-[7px] pl-[11px] text-[11.5px] text-ink-5"
    >
      Du bist noch in keiner Gruppe.
    </p>

    <!-- The counterpart of "+ Thread" in the tab strip: same words, same weight, and a
         transparent segment of the rule so it reads as an action rather than a group. The
         verb it is missing is in the dialog it opens. -->
    <button
      type="button"
      class="flex items-center gap-[4px] border-l-2 border-transparent py-[7px] pl-[11px] text-[13px] leading-[1.3] text-ink-5 hover:text-oak-deep"
      aria-label="Gruppe gründen"
      @click="$emit('create')"
    >
      <Plus :size="14" :stroke-width="1.5" />
      Gruppe
    </button>
  </div>
</template>
