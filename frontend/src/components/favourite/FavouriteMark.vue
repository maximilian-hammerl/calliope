<script setup lang="ts">
/**
 * The word costs about 55px and the star 25, which is what lets the tab strip, the chats rail and
 * the search popover carry it. The button keeps its words: it names the state it will move the
 * thing *to*, so a star there would mark the things that are **not** favourites.
 */
import { Star } from '@lucide/vue'
import StateMark from '@/components/common/StateMark.vue'
</script>

<template>
  <StateMark :icon="Star" label="Favorit" />
</template>
