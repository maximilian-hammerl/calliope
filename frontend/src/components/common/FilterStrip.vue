<script setup lang="ts" generic="Value extends string">
/**
 * Mutually exclusive options as one strip, marked the way the thread tabs and the bottom bar
 * mark theirs: a 2px oak rule under the chosen one, a lighter rule under the rest. The shared
 * baseline is what makes them read as one control — separate filled buttons read as separate
 * things, which is the "card rather than a position" the design system rejected.
 *
 * Never the solid button level: that is the one primary act of a screen, and a filter is not it.
 *
 * `md:contents` dissolves the wrapper into the parent's grid, so every label sits in a column
 * as wide as the longest of them and the strips line up. Below `md` the wrapper stays a box,
 * which is what keeps a label nearer its own strip than the one above — measured at 4px to
 * both before this, so the grouping read as ambiguous.
 */
const model = defineModel<Value>({ required: true })

const props = defineProps<{
  label: string
  options: ReadonlyArray<{ value: Value; label: string }>
}>()

const id = `filter-strip-${props.label.replaceAll(/\s+/gu, '-').toLowerCase()}`
</script>

<template>
  <div class="flex flex-col md:contents">
    <span :id="id" class="text-[12.5px] text-ink-5 md:pb-[11px]">{{ label }}</span>

    <div role="group" :aria-labelledby="id" class="flex min-w-0 items-end gap-5 overflow-x-auto">
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :aria-pressed="model === option.value"
        class="flex min-h-11 flex-none items-end pb-[11px] text-[13.5px] leading-[1.2] whitespace-nowrap md:min-h-0"
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
