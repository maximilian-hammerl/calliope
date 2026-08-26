<script setup lang="ts" generic="Value extends string">
/**
 * Mutually exclusive options as one strip, marked the way the thread tabs and the bottom bar
 * mark theirs: a 2px oak rule under the chosen one, a lighter rule under the rest. The shared
 * baseline is what makes them read as one control — separate filled buttons read as separate
 * things, which is the "card rather than a position" the design system rejected.
 *
 * Never the solid button level: that is the one primary act of a screen, and a filter is not it.
 *
 * **It lays out its own label**, beside the options from `md` up and above them below it. It used
 * to require the parent to be a two-column grid, which is a rule a call site cannot see: the
 * groups and discovery pages drifted for months, and the thread's filter never had it at all.
 *
 * Inside a `FilterStrips` it dissolves into that grid instead (`md:contents`), so a run of strips
 * shares one label column and their options line up. Alone, it opens a two-column grid of its own.
 *
 * Below `md` the wrapper stays a box either way, which is what keeps a label nearer its own strip
 * than the one above — measured at 4px to both before this, so the grouping read as ambiguous.
 */
import { computed, inject } from 'vue'
import { FILTER_STRIP_GROUP } from './filterStripGroup'

const model = defineModel<Value>({ required: true })

const props = defineProps<{
  label: string
  options: ReadonlyArray<{ value: Value; label: string }>
  /**
   * Draw the label for screen readers only. For a strip that chooses a *view* the heading above it
   * already says what it is about, and the word is one too many — but the group still needs a name.
   */
  hideLabel?: boolean
}>()

const id = `filter-strip-${props.label.replaceAll(/\s+/gu, '-').toLowerCase()}`

const inGroup = inject(FILTER_STRIP_GROUP, false)

/**
 * A hidden label occupies no column — it is out of flow — so a grid would only indent the options
 * by the column gap.
 */
const layout = computed<string>(() => {
  if (props.hideLabel) {
    return inGroup ? 'md:col-span-2' : ''
  }
  return inGroup ? 'md:contents' : 'md:grid md:grid-cols-[max-content_1fr] md:items-end md:gap-x-4'
})
</script>

<template>
  <div class="flex flex-col" :class="layout">
    <span :id="id" :class="hideLabel ? 'sr-only' : 'text-[12.5px] text-ink-5 md:pb-[11px]'">{{
      label
    }}</span>

    <div role="group" :aria-labelledby="id" class="flex min-w-0 items-end gap-5 overflow-x-auto">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :aria-pressed="model === option.value"
        class="flex min-h-11 flex-none items-end pb-[11px] text-nav whitespace-nowrap md:min-h-0"
        :class="
          model === option.value
            ? 'border-b-2 border-oak font-medium text-ink-1'
            : 'border-b-[1.5px] border-line-5 text-ink-5 hover:text-ink-2'
        "
        @click="model = option.value"
      >
        {{ option.label }}
      </button>
    </div>
  </div>
</template>
