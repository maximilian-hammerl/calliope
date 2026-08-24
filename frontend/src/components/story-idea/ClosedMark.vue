<script setup lang="ts">
/**
 * `CircleCheckBig` rather than a lock: a closed idea keeps its page and every word of it, so a lock
 * would say you cannot get in. The author has only stopped looking, which a check already says.
 */
import { CircleCheckBig } from '@lucide/vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import { IDEA_STATUS_LABELS } from '@/lib/format/storyIdea'

const LABEL = IDEA_STATUS_LABELS.closed
</script>

<template>
  <CalliopeBadge variant="mark" :title="LABEL" :aria-label="LABEL" role="img" class="shrink-0">
    <CircleCheckBig :size="13" :stroke-width="1.5" aria-hidden="true" />
  </CalliopeBadge>
</template>
