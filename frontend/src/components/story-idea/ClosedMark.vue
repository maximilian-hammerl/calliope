<script setup lang="ts">
/**
 * `CircleCheckBig` rather than a lock: a closed idea keeps its page and every word of it, so a lock
 * would say you cannot get in. The author has only stopped looking, which a check already says.
 */
import { CircleCheckBig } from '@lucide/vue'
import StateMark from '@/components/common/StateMark.vue'
import { IDEA_STATUS_LABELS } from '@/lib/format/storyIdea'
</script>

<template>
  <StateMark :icon="CircleCheckBig" :label="IDEA_STATUS_LABELS.closed" />
</template>
