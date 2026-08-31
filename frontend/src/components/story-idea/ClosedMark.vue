<script setup lang="ts">
/**
 * The glyph and the word both come from `IDEA_STATUS_ICONS`, beside the labels, so this mark and
 * the badge on the idea's own page cannot say the state two ways.
 */
import StateMark from '@/components/common/StateMark.vue'
import { IDEA_STATUS_ICONS, IDEA_STATUS_LABELS } from '@/lib/format/storyIdea'

defineProps<{ interactive?: boolean }>()
</script>

<template>
  <StateMark
    :icon="IDEA_STATUS_ICONS.closed"
    :label="IDEA_STATUS_LABELS.closed"
    :interactive="interactive"
  />
</template>
