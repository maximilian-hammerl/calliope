<script setup lang="ts">
import { nextTick, ref, useTemplateRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import { ChevronLeft, ChevronRight, Plus } from '@lucide/vue'
import type { ListThreads200ResultsItem } from '@/api/models'
import FavouriteMark from '@/components/favourite/FavouriteMark.vue'

const props = defineProps<{
  groupId: string
  threads: ListThreads200ResultsItem[]
  activeId?: string
  mayWrite: boolean
}>()
defineEmits<{ create: [] }>()

const scroller = useTemplateRef<HTMLDivElement>('scroller')

/**
 * Whether either end is reached. The strip hides its scrollbar, so without this there is
 * nothing on screen saying more threads exist — and a mouse without a horizontal wheel had no
 * way to reach them at all.
 */
const atStart = ref<boolean>(true)
const atEnd = ref<boolean>(true)

function measure(): void {
  const element = scroller.value
  if (element === null) {
    return
  }
  atStart.value = element.scrollLeft <= 1
  atEnd.value = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1
}

/**
 * Not a fixed step: a strip is scrolled by about what it shows, whatever width that is. The
 * easing is CSS (`motion-safe:scroll-smooth`), so somebody who asked for less motion gets a
 * jump instead of an animation.
 */
function nudge(direction: -1 | 1): void {
  const element = scroller.value
  if (element === null) {
    return
  }
  element.scrollLeft += direction * element.clientWidth * 0.8
  // Also measured here, not only from the scroll event: one coalesced event would leave the
  // arrows describing the wrong end, and the event is what the click is for.
  measure()
}

// Both a wider window and another thread change whether there is anything to reach.
useResizeObserver(scroller, measure)
watch(
  () => props.threads.length,
  async () => {
    await nextTick()
    measure()
  },
  { immediate: true },
)
</script>

<template>
  <!-- Threads live in tabs, so they appear nowhere else. Sticky under the group title, on
       solid paper so the posts never show through it. -->
  <div
    class="sticky top-0 z-[2] bg-paper-1 px-gutter shadow-[0_1px_0_var(--color-line-3)] md:px-10 md:pt-[15px]"
  >
    <!-- The tabs scroll; the arrows and "Thread" do not. Inside the scroller the create button
         was pushed off the edge by the tenth tab, which made starting a thread unreachable in
         exactly the groups that write the most. -->
    <div class="reading-column flex items-baseline gap-3">
      <button
        v-if="!atStart"
        type="button"
        class="flex min-h-11 flex-none items-end pb-[11px] text-ink-5 hover:text-oak-deep md:min-h-0"
        aria-label="Zu den neueren Threads"
        @click="nudge(-1)"
      >
        <ChevronLeft :size="16" :stroke-width="1.5" />
      </button>

      <div
        ref="scroller"
        class="scroll-x-hidden flex min-w-0 flex-1 items-baseline gap-5 text-nav whitespace-nowrap motion-safe:scroll-smooth"
        @scroll="measure"
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
          <FavouriteMark v-if="thread.isFavourite" class="ml-1.5" />
        </RouterLink>
      </div>

      <button
        v-if="!atEnd"
        type="button"
        class="flex min-h-11 flex-none items-end pb-[11px] text-ink-5 hover:text-oak-deep md:min-h-0"
        aria-label="Zu den älteren Threads"
        @click="nudge(1)"
      >
        <ChevronRight :size="16" :stroke-width="1.5" />
      </button>

      <button
        v-if="mayWrite"
        type="button"
        class="flex min-h-11 flex-none items-end gap-1 border-b-2 border-transparent pb-[11px] text-nav whitespace-nowrap text-ink-5 hover:text-oak-deep md:min-h-0 md:items-center"
        aria-label="Thread anlegen"
        @click="$emit('create')"
      >
        <Plus :size="14" :stroke-width="1.5" />
        Thread
      </button>
    </div>
  </div>
</template>
