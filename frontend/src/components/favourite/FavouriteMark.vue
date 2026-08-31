<script setup lang="ts">
/**
 * The glyph and the word both come from `lib/format/favourite`, beside the toggle that names the
 * same state, so a row and a button cannot say it two ways.
 *
 * The word costs about 55px and the star 25, which is what lets the tab strip, the chats rail and
 * the search popover carry it.
 */
import StateMark from '@/components/common/StateMark.vue'
import { FAVOURITE_ICONS, FAVOURITE_LABELS } from '@/lib/format/favourite'

defineProps<{ interactive?: boolean }>()
</script>

<template>
  <StateMark
    :icon="FAVOURITE_ICONS.favourite"
    :label="FAVOURITE_LABELS.favourite"
    :interactive="interactive"
  />
</template>
