<script setup lang="ts">
/**
 * What the group agreed the story is: the reference a member checks while writing a post. Only
 * filled fields appear — an empty story should read as empty, not as a column of "nicht gesetzt".
 */
import { computed } from 'vue'
import type { GetGroup200 } from '@/api/models'
import {
  PERSPECTIVE_LABELS,
  TENSE_LABELS,
  contentWarningLine,
  genreLine,
  subgenreLine,
  tropeLine,
} from '@/lib/story/storyVocabulary'

const props = defineProps<{ group: GetGroup200 }>()

const fields = computed<Array<{ label: string; value: string }>>(() => {
  return [
    { label: 'Genre', value: genreLine(props.group.genres) },
    { label: 'Subgenre', value: subgenreLine(props.group.subgenres) },
    { label: 'Tropes', value: tropeLine(props.group.tropes) },
    { label: 'Themen', value: props.group.storyThemes ?? undefined },
    { label: 'Schauplätze', value: props.group.storySettings ?? undefined },
    {
      label: 'Zeitform',
      value: props.group.tense === null ? undefined : TENSE_LABELS[props.group.tense],
    },
    {
      label: 'Perspektive',
      value:
        props.group.perspective === null ? undefined : PERSPECTIVE_LABELS[props.group.perspective],
    },
    { label: 'Inhaltswarnungen', value: contentWarningLine(props.group.contentWarnings) },
  ].filter((field): field is { label: string; value: string } => field.value !== undefined)
})
</script>

<template>
  <div v-if="fields.length > 0">
    <div class="text-rail text-ink-4">
      <div v-for="field in fields" :key="field.label">
        <span class="text-ink-6">{{ field.label }}:&nbsp;</span>
        <span>{{ field.value }}</span>
      </div>
    </div>
  </div>
</template>
