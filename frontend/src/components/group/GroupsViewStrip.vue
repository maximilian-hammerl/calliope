<script setup lang="ts">
/**
 * Which view of the groups a member is looking at, as a strip rather than a menu in the bar.
 *
 * It sits directly under the heading on both pages, and that position is the point: discovery was
 * once a text link *below* the list, where testers missed it and a member with many groups never
 * reached it. First thing on the page, marked the way the thread tabs and the bars mark theirs.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import FilterStrip from '@/components/common/FilterStrip.vue'

const VIEWS = [
  { value: 'myGroups', label: 'Meine Gruppen' },
  { value: 'discoverGroups', label: 'Gruppen entdecken' },
] as const

type View = (typeof VIEWS)[number]['value']

const route = useRoute()
const router = useRouter()

const view = computed<View>({
  get: () => (route.name === 'discoverGroups' ? 'discoverGroups' : 'myGroups'),
  set: (value) => void router.push({ name: value }),
})
</script>

<template>
  <FilterStrip v-model="view" label="Ansicht" hide-label :options="VIEWS" />
</template>
