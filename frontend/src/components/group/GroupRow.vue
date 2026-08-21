<script setup lang="ts">
import type { ListGroups200ResultsItem } from '@/api/models'
import { formatActivityTime } from '@/lib/format/formatTime'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'

/**
 * One group in a list. Meine Gruppen, Einladungen and Gruppen entdecken all show the same
 * thing and differ only in what may be done with it, which is the slot.
 */
defineProps<{ group: ListGroups200ResultsItem }>()

defineSlots<{ actions?: () => unknown; meta?: () => unknown }>()
</script>

<template>
  <!-- Hairline rows, no cards: nothing in the reading surface is boxed or rounded. -->
  <div class="py-[26px]">
    <div class="text-[20px] leading-[1.3]">
      <RouterLink
        :to="{ name: 'group', params: { groupId: group.id } }"
        class="text-ink-1 underline-offset-[6px] hover:underline"
      >
        {{ group.title }}
      </RouterLink>
      <CalliopeBadge class="ml-3">
        {{ group.visibility === 'private' ? 'Privat' : 'Öffentlich' }}
      </CalliopeBadge>
    </div>

    <!-- The story's own line, between its name and what it is about. Darker and a step larger
         than the synopsis, so the order reads title → subtitle → synopsis. -->
    <p v-if="group.subtitle" class="mt-[4px] max-w-[60ch] text-[13.5px] leading-[1.5] text-ink-3">
      {{ group.subtitle }}
    </p>

    <!-- Clamped, like a story idea's teaser: a synopsis may run to eight thousand characters,
         and one long one would otherwise push every row after it off the page. -->
    <p
      v-if="group.synopsis"
      class="mt-[6px] line-clamp-3 max-w-[60ch] text-[13px] leading-[1.6] text-ink-4"
    >
      {{ group.synopsis }}
    </p>

    <!-- Every date this row shows sits on one line, so an invitation's own date joins the
         group's activity rather than starting a second meta line. -->
    <div class="mt-[6px] text-[12.5px] leading-[1.95] text-ink-5">
      zuletzt {{ formatActivityTime(group.lastActivityAt) }}<slot name="meta" />
    </div>

    <div v-if="$slots.actions" class="mt-[10px] flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
