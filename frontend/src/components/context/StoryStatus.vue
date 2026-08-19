<script setup lang="ts">
/**
 * Was a placeholder with invented values until the group carried its own metadata. Only the
 * fields that were actually filled in appear: an empty story should read as empty rather than
 * as a column of "Noch nicht gesetzt".
 */
import { computed } from 'vue'
import type { GetGroup200 } from '@/api/models'

const props = defineProps<{ group: GetGroup200 }>()

const STATUS_LABELS = {
  planning: 'In Planung',
  writing: 'Wird geschrieben',
  finished: 'Abgeschlossen',
} as const

const fields = computed(() => {
  const list = (tags: readonly string[]) => (tags.length === 0 ? undefined : tags.join(', '))

  return [
    { label: 'Status', value: STATUS_LABELS[props.group.storyStatus], strong: true },
    { label: 'Genre', value: list(props.group.genres) },
    { label: 'Subgenre', value: list(props.group.subgenres) },
    { label: 'Tropes', value: list(props.group.tropes) },
    { label: 'Zeitform', value: props.group.tense ?? undefined },
    { label: 'Perspektive', value: props.group.perspective ?? undefined },
    { label: 'Inhaltswarnungen', value: list(props.group.contentWarnings) },
  ].filter((field) => field.value !== undefined)
})
</script>

<template>
  <div>
    <div class="mb-[10px] text-[12.5px] font-semibold text-ink-4">Story-Status</div>
    <div class="text-[12.5px] leading-[1.95] text-ink-4">
      <div v-for="field in fields" :key="field.label">
        <span class="text-ink-6">{{ field.label }}:&nbsp;</span>
        <span :class="field.strong ? 'font-medium' : ''">{{ field.value }}</span>
      </div>
    </div>
  </div>
</template>
