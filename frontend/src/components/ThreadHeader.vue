<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import { computed } from 'vue'
import { countLabel, formatActivityTime } from '@/lib/formatTime'

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
  <div class="mb-7 flex items-end gap-4">
    <div>
      <h2 class="mb-[5px] text-[20px] leading-[1.3] text-ink-1">{{ title }}</h2>
      <div v-if="meta" class="text-[12.5px] leading-[1.3] text-ink-5">{{ meta }}</div>
    </div>
    <!-- Placeholder: there is no post filter behind this yet. -->
    <button
      type="button"
      disabled
      class="ml-auto hidden items-center gap-[6px] sm:flex rounded-lg border border-line-4 bg-paper-1 px-[11px] py-[6px] text-[12.5px] text-oak-deep disabled:opacity-50"
      title="Noch nicht verfügbar"
    >
      Alle Beiträge
      <ChevronDown :size="14" :stroke-width="1.5" class="text-ink-5" />
    </button>
  </div>
</template>
