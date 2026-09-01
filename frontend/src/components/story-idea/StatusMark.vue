<script setup lang="ts">
/**
 * Two-sided, like `VisibilityMark`: an idea is always open or closed, so „offen" is read rather
 * than inferred from a missing check. It was one-sided until the reasoning was compared with the
 * group's and found to be the same argument pointed the other way — see the design system, which
 * now records what actually decides it.
 *
 * The glyph and the word both come from `lib/format/storyIdea`, beside the toggle that names the
 * same state, so a row and a page cannot say it two ways.
 */
import type { GetStoryIdea200 } from '@/api/models'
import StateMark from '@/components/common/StateMark.vue'
import { IDEA_STATUS_ICONS, IDEA_STATUS_LABELS } from '@/lib/format/storyIdea'

const props = defineProps<{ status: GetStoryIdea200['status']; interactive?: boolean }>()
</script>

<template>
  <StateMark
    :icon="IDEA_STATUS_ICONS[props.status]"
    :label="IDEA_STATUS_LABELS[props.status]"
    :interactive="props.interactive"
  />
</template>
