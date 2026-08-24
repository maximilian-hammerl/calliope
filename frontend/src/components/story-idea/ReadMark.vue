<script setup lang="ts">
/**
 * „Gelesen" as a mark, the read state's half of what `FavouriteMark` does for favourites — the two
 * sit side by side on an idea row and are built alike for that reason.
 *
 * `BookCheck` rather than `BookOpenCheck`: an open book reads as *being* read, and its two page
 * curves plus the check are dense at 14px. A closed book with a check is a finished one. The check
 * is not the collision with `SquareCheck` it first looks like — a check means done in both, and the
 * noun in front of it says done with what.
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
