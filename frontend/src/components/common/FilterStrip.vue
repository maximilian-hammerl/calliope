<script setup lang="ts" generic="Value extends string">
/**
 * Mutually exclusive options as one strip, marked the way the thread tabs and the bottom bar
 * mark theirs: a 2px oak rule under the chosen one, a lighter rule under the rest. The shared
 * baseline is what makes them read as one control — separate filled buttons read as separate
 * things, which is the "card rather than a position" the design system rejected.
 *
 * Never the solid button level: that is the one primary act of a screen, and a filter is not it.
 *
 * **`FilterSection` owns the label and the disclosure**, and the story vocabularies render
 * through the same component — the label style drifted between the two while they were separate.
 * Inside a `FilterStrips` the section dissolves into that grid so a run of filters shares one
 * label column; alone it opens a two-column grid of its own.
 */
import { computed } from 'vue'
import FilterSection from './FilterSection.vue'

const model = defineModel<Value>({ required: true })

const props = defineProps<{
  label: string
  options: ReadonlyArray<{ value: Value; label: string }>
  /**
   * What the page opens with. Given it, the strip can say when it has been moved off it — a strip
   * always has something selected, so "chosen" alone would mark every filter as narrowing.
   */
  defaultValue?: Value
  /**
   * Draw the label for screen readers only. For a strip that chooses a *view* the heading above it
   * already says what it is about, and the word is one too many — but the group still needs a name.
   */
  hideLabel?: boolean
}>()

/**
 * A word rather than the chosen option's own label: „Offen oder geschlossen · Geschlossen" is
 * wide, and the label column is shared, so every filter's options would shift as one of them
 * changed. What matters when a section is shut is that it is narrowing at all.
 */
const chosen = computed<string | undefined>(() =>
  props.defaultValue !== undefined && model.value !== props.defaultValue ? 'aktiv' : undefined,
)
</script>

<template>
  <FilterSection :label="label" :hide-label="hideLabel" :chosen="chosen">
    <template #default="{ labelId }">
      <div
        role="group"
        :aria-labelledby="labelId"
        class="flex min-w-0 items-end gap-5 overflow-x-auto"
      >
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
    </template>
  </FilterSection>
</template>
