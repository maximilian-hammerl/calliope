<script setup lang="ts">
import type { ListGroups200ResultsItem } from '@/api/models'
import { formatActivityTime } from '@/lib/format/formatTime'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'

/**
 * One group in a list. Meine Gruppen, Einladungen and Gruppen entdecken all show the same
 * thing and differ only in what may be done with it, which is the slot.
 */
defineProps<{ group: ListGroups200ResultsItem }>()

defineSlots<{ actions?: () => unknown }>()
</script>

<template>
  <!-- Hairline rows, no cards: nothing in the reading surface is boxed or rounded. -->
  <div class="py-[26px]">
    <div class="flex flex-wrap items-baseline gap-3">
      <RouterLink
        :to="{ name: 'group', params: { groupId: group.id } }"
        class="text-[20px] leading-[1.3] text-ink-1 hover:underline hover:underline-offset-[6px]"
      >
        {{ group.title }}
      </RouterLink>
      <CalliopeBadge>
        {{ group.visibility === 'private' ? 'Privat' : 'Öffentlich' }}
      </CalliopeBadge>
    </div>

    <p v-if="group.description" class="mt-[6px] max-w-[60ch] text-[13px] leading-[1.6] text-ink-4">
      {{ group.description }}
    </p>

    <div class="mt-[6px] text-[12.5px] leading-[1.95] text-ink-5">
      zuletzt {{ formatActivityTime(group.lastActivityAt) }}
    </div>

    <div class="mt-[10px] flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
