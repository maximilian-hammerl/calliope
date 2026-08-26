<script setup lang="ts">
/**
 * Which view of the story ideas a member is reading, as a strip rather than a menu in the bar.
 * Sits under the heading on all three pages — see `GroupsViewStrip` for why that position.
 *
 * **The labels are short where the groups strip spells its views out.** Measured at 375px: the
 * page titles come to 379px against 339px of gutter-to-gutter room, so the third view would have
 * needed scrolling to reach — which is the way discovery got missed the last time.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FilterStrip from '@/components/common/FilterStrip.vue'

/** Primary first, which is also where the bar now goes. */
const VIEWS = [
  { value: 'storyIdeasCarousel', label: 'Karussell' },
  { value: 'myStoryIdeas', label: 'Meine Ideen' },
  { value: 'discoverStoryIdeas', label: 'Ideen entdecken' },
] as const

type View = (typeof VIEWS)[number]['value']

const route = useRoute()
const router = useRouter()

const view = computed<View>({
  // The strip is only rendered on those three, so the fallback is unreachable; the primary view is
  // the least surprising thing to mark if that ever stops being true.
  get: () => VIEWS.find(({ value }) => value === route.name)?.value ?? 'storyIdeasCarousel',
  set: (value) => void router.push({ name: value }),
})
</script>

<template>
  <FilterStrip v-model="view" label="Ansicht" hide-label :options="VIEWS" />
</template>
