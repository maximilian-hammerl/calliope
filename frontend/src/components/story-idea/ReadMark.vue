<script setup lang="ts">
/**
 * The glyph and the word both come from `lib/format/storyIdea`, beside the toggle that names the
 * same state, so a row and a button cannot say it two ways.
 */
import StateMark from '@/components/common/StateMark.vue'
import { READ_ICONS, READ_LABELS } from '@/lib/format/storyIdea'

defineProps<{ interactive?: boolean }>()
</script>

<template>
  <StateMark :icon="READ_ICONS.read" :label="READ_LABELS.read" :interactive="interactive" />
</template>
