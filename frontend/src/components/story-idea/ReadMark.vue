<script setup lang="ts">
/**
 * `BookCheck`, not `BookOpenCheck`: an open book reads as *being* read, and its page curves plus
 * the check are dense at 13px.
 */
import { BookCheck } from '@lucide/vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'

const LABEL = 'Gelesen'
</script>

<template>
  <CalliopeBadge variant="mark" :title="LABEL" :aria-label="LABEL" role="img" class="shrink-0">
    <BookCheck :size="13" :stroke-width="1.5" aria-hidden="true" />
  </CalliopeBadge>
</template>
