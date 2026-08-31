<script setup lang="ts" generic="T extends string">
/**
 * Several of something, marked the way `FilterStrip` marks one: a 2px oak rule under each chosen
 * option and a lighter rule under the rest. Filled or outlined boxes were tried first and are what
 * the design system calls a card rather than a position — the same reason the navigation menu
 * drops shadcn's pills.
 *
 * It wraps where `FilterStrip` scrolls. Three or four options fit a row and a strip that scrolls
 * reads as one control; seventy-six subgenres on one scrolling line would hide most of themselves,
 * so these run on as many rows as they need and each row keeps its own baseline.
 *
 * Raw buttons rather than `Button`, as the strip does: these are options on a shared baseline
 * rather than controls, so they carry the 44px phone rule themselves.
 */
const selected = defineModel<T[]>({ required: true })

defineProps<{
  options: ReadonlyArray<{ value: T; label: string }>
  /** Names the group for a screen reader, since the chips carry no label of their own. */
  label: string
}>()

function toggle(value: T) {
  selected.value = selected.value.includes(value)
    ? selected.value.filter((each) => each !== value)
    : [...selected.value, value]
}
</script>

<template>
  <div role="group" :aria-label="label" class="flex flex-wrap items-end gap-x-5 gap-y-1">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="selected.includes(option.value)"
      class="flex min-h-11 flex-none items-end pb-[11px] text-nav whitespace-nowrap md:min-h-0"
      :class="
        selected.includes(option.value)
          ? 'border-b-2 border-oak font-medium text-ink-1'
          : 'border-b-[1.5px] border-line-5 text-ink-5 hover:text-ink-2'
      "
      @click="toggle(option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
