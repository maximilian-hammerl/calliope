<script setup lang="ts">
/**
 * „Geschlossen" as a mark. `CircleCheckBig` rather than a lock, which was the first thought and the
 * wrong one: a closed idea keeps its page and every word of it, and a lock says you cannot get in.
 * The author has finished looking for co-writers, which is settled rather than shut — and a check
 * already means *done* here, with the noun in front saying done with what.
 *
 * One-sided, like every mark here: an open idea is the board's resting state and takes no chip. The
 * idea's own page still writes both words out, because there the status is the subject.
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
