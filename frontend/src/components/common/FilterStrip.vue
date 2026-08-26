<script setup lang="ts" generic="Value extends string">
/**
 * Mutually exclusive options as one strip, marked the way the thread tabs and the bottom bar
 * mark theirs: a 2px oak rule under the chosen one, a lighter rule under the rest. The shared
 * baseline is what makes them read as one control — separate filled buttons read as separate
 * things, which is the "card rather than a position" the design system rejected.
 *
 * Never the solid button level: that is the one primary act of a screen, and a filter is not it.
 *
 * **The parent must be `md:grid md:grid-cols-[max-content_1fr]`, even for a single strip.**
 * `md:contents` dissolves this wrapper, so the label and the options become the parent's own
 * children: in that grid they line up in two columns, with every label column as wide as the
 * longest. In a plain block they stack instead, and nothing says so — the groups and discovery
 * pages drifted that way for months because one strip felt like it did not need a grid.
 *
 * Below `md` the wrapper stays a box, which is what keeps a label nearer its own strip than the
 * one above — measured at 4px to both before this, so the grouping read as ambiguous.
 */
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
</script>

<template>
  <div class="flex flex-col md:contents">
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
