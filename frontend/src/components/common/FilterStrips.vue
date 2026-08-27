<script setup lang="ts">
/**
 * Several `FilterStrip`s stacked, sharing one label column so their options start at the same
 * place. That shared column is the whole reason this exists: separate grids would each size their
 * own label, and the strips would step raggedly to the right down the page.
 *
 * A single strip does not need this — it lays itself out. Reach for it when there are two or more.
 */
import { provide } from 'vue'
import { FILTER_STRIP_GROUP } from './filterStripGroup'

provide(FILTER_STRIP_GROUP, true)
</script>

<template>
  <div
    class="flex flex-col gap-4 md:grid md:grid-cols-[max-content_1fr] md:items-end md:gap-x-4 md:gap-y-1"
  >
    <slot />
  </div>
</template>
