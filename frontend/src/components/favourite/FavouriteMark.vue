<script setup lang="ts">
/**
 * „Favorit" as a mark rather than a badge, for a row that states the reader's own favourite. The
 * word costs about 55px and the star about 22, which is what lets the tab strip and the chats rail
 * carry it at all — the badge made a favourited chat row 22px taller than its neighbours.
 *
 * The button keeps its words: it names the state it will move the thing *to*, so a star on it
 * would mark the things that are **not** favourites, forty pixels from a star that means they are.
 * A mark cannot point forward and describe the present at once.
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
