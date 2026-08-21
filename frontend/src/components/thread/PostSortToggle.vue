<script setup lang="ts">
/**
 * Which end of the thread to start at. A story is written front to back, but somebody
 * returning to it wants the newest first — so this is a choice rather than a default.
 */
const order = defineModel<'oldest' | 'newest'>({ required: true })

const OPTIONS = [
  { value: 'oldest', label: 'Älteste zuerst' },
  { value: 'newest', label: 'Neueste zuerst' },
] as const
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-1" role="group" aria-label="Reihenfolge">
    <button
      v-for="option in OPTIONS"
      :key="option.value"
      type="button"
      class="flex min-h-11 items-center border-b-2 text-[13px] md:min-h-9"
      :class="
        order === option.value
          ? 'border-oak font-medium text-ink-1'
          : 'border-transparent text-ink-5 hover:text-oak-deep'
      "
      :aria-pressed="order === option.value"
      @click="order = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
