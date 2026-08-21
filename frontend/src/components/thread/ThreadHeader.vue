<script setup lang="ts">
import { computed } from 'vue'
import { countLabel, formatActivityTime } from '@/lib/format/formatTime'

const props = defineProps<{
  title: string
  postCount?: number
  lastActivityAt?: string
}>()

// Numbers always carry a noun: a bare badge number was tested and misread.
const meta = computed<string>(() =>
  [
    props.postCount === undefined ? undefined : countLabel(props.postCount, 'Beitrag', 'Beiträge'),
    props.lastActivityAt === undefined
      ? undefined
      : `zuletzt ${formatActivityTime(props.lastActivityAt)}`,
  ]
    .filter((part) => part !== undefined)
    .join(' · '),
)
</script>

<template>
  <!-- The post filter the design system specifies belongs here ("Alle Beiträge ▾"), and is
       absent rather than disabled: both of its real options, Gemerkt and Mit Anmerkungen,
       depend on post actions that do not exist yet, and a dead control now sits beside the
       working order toggle and page strip below. The prototype keeps the specification. -->
  <div class="mb-7">
    <h2 class="mb-[5px] text-[20px] leading-[1.3] text-ink-1">{{ title }}</h2>
    <div v-if="meta" class="text-[12.5px] leading-[1.3] text-ink-5">{{ meta }}</div>
  </div>
</template>
