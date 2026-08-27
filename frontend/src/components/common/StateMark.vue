<script setup lang="ts">
/**
 * A glyph where a word chip would go, for a state a row states about itself. The chrome lives here
 * rather than in each mark: the size, the `mark` variant and — the part worth forgetting — the
 * accessible name, since these are the only icons in the interface that are not `aria-hidden`.
 *
 * `title` sits on the badge rather than the `<svg>`, where it is not a tooltip: SVG reads a
 * `<title>` child instead. Hover is desktop-only, so `aria-label` is what carries a phone.
 */
import type { Component } from 'vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'

defineProps<{ icon: Component; label: string }>()
</script>

<template>
  <CalliopeBadge variant="mark" :title="label" :aria-label="label" role="img" class="shrink-0">
    <component :is="icon" :size="13" :stroke-width="1.5" aria-hidden="true" />
  </CalliopeBadge>
</template>
