<script setup lang="ts">
/**
 * The word costs about 55px and the star 25, which is what lets the tab strip, the chats rail and
 * the search popover carry it. The button keeps its words: it names the state it will move the
 * thing *to*, so a star there would mark the things that are **not** favourites.
 */
import { Star } from '@lucide/vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'

/** Named rather than hidden: unlike the icons inside a button, nothing beside this says it. */
const LABEL = 'Favorit'
</script>

<template>
  <!-- On a span, because `title` on an `<svg>` is not a tooltip — SVG reads a `<title>` child
       instead. Hover is desktop-only, so the accessible name is what carries it on a phone. -->
  <CalliopeBadge variant="mark" :title="LABEL" :aria-label="LABEL" role="img" class="shrink-0">
    <Star :size="13" :stroke-width="1.5" aria-hidden="true" />
  </CalliopeBadge>
</template>
