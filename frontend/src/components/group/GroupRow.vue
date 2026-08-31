<script setup lang="ts">
import type { ListGroups200ResultsItem } from '@/api/models'
import { formatActivityTime } from '@/lib/format/formatTime'
import VisibilityMark from '@/components/group/VisibilityMark.vue'
import FavouriteMark from '@/components/favourite/FavouriteMark.vue'

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
    <div class="text-h2">
      <RouterLink
        :to="{ name: 'group', params: { groupId: group.id } }"
        class="text-ink-1 underline-offset-[6px] hover:underline"
      >
        {{ group.title }}
      </RouterLink>
      <VisibilityMark :visibility="group.visibility" class="ml-3" interactive />
      <!-- After the group's own state, because this one is the reader's: the same order the
           story-idea row puts them in. -->
      <FavouriteMark v-if="group.isFavourite" class="ml-3" interactive />
    </div>

    <!-- The story's own line, between its name and what it is about. Darker and a step larger
         than the synopsis, so the order reads title → subtitle → synopsis. -->
    <p v-if="group.subtitle" class="mt-1 max-w-[60ch] text-note text-ink-3">
      {{ group.subtitle }}
    </p>

    <!-- Clamped, like a story idea's teaser: a synopsis may run to eight thousand characters,
         and one long one would otherwise push every row after it off the page. -->
    <p v-if="group.synopsis" class="mt-1.5 line-clamp-3 max-w-[60ch] text-row text-ink-4">
      {{ group.synopsis }}
    </p>

    <!-- Every date this row shows sits on one line, so an invitation's own date joins the
         group's activity rather than starting a second meta line. -->
    <div class="mt-1.5 text-rail text-ink-5">
      zuletzt {{ formatActivityTime(group.lastActivityAt) }}<slot name="meta" />
    </div>

    <div v-if="$slots.actions" class="mt-2.5 flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
