<script setup lang="ts">
/**
 * What the group agreed the story is: the reference a member checks while writing a post. Only
 * filled fields appear — an empty story should read as empty, not as a column of "nicht gesetzt".
 */
import { computed } from 'vue'
import type { GetGroup200 } from '@/api/models'

const props = defineProps<{ group: GetGroup200 }>()

const fields = computed<Array<{ label: string; value: string }>>(() => {
  const list = (tags: readonly string[]) => (tags.length === 0 ? undefined : tags.join(', '))

  return [
    { label: 'Genre', value: list(props.group.genres) },
    { label: 'Subgenre', value: list(props.group.subgenres) },
    { label: 'Tropes', value: list(props.group.tropes) },
    { label: 'Zeitform', value: props.group.tense ?? undefined },
    { label: 'Perspektive', value: props.group.perspective ?? undefined },
    { label: 'Inhaltswarnungen', value: list(props.group.contentWarnings) },
  ].filter((field): field is { label: string; value: string } => field.value !== undefined)
})
</script>

<template>
  <div v-if="fields.length > 0">
    <div class="mb-[10px] text-[12.5px] font-semibold text-ink-4">Die Geschichte</div>
    <div class="text-[12.5px] leading-[1.95] text-ink-4">
      <div v-for="field in fields" :key="field.label">
        <span class="text-ink-6">{{ field.label }}:&nbsp;</span>
        <span>{{ field.value }}</span>
      </div>
    </div>
  </div>
</template>
