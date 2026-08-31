<script setup lang="ts">
/**
 * A group's metadata: the story vocabularies plus the two things only a group has — the story's
 * own status and the language it is written in. The vocabularies live in `StoryVocabularyFields`
 * because a story idea carries exactly the same ones, and the two forms drifting apart is what
 * went wrong the last time they were written twice.
 */
import { computed } from 'vue'
import { LANGUAGE_LABELS } from '@/lib/format/storyIdea'
import StoryVocabularyFields from '@/components/story/StoryVocabularyFields.vue'
import type { StoryVocabulary } from '@/components/story/StoryVocabularyFields.vue'
import { Field, FieldLabel } from '@/components/ui/field'

export type StoryMetadata = StoryVocabulary & {
  storyStatus: 'planning' | 'writing' | 'finished'
  language: 'german' | 'english'
}

const metadata = defineModel<StoryMetadata>({ required: true })

/** The wrapper writes back into the same object, so the child never sees status or language. */
const vocabulary = computed<StoryVocabulary>({
  get: () => metadata.value,
  set: (next) => {
    metadata.value = { ...metadata.value, ...next }
  },
})

const STATUS_LABELS = [
  { value: 'planning', label: 'In Planung' },
  { value: 'writing', label: 'Wird geschrieben' },
  { value: 'finished', label: 'Abgeschlossen' },
] as const

const selectClass =
  'h-11 w-full rounded-lg border border-line-4 bg-paper-0 px-[11px] text-[13.5px] text-ink-2 md:h-9'
</script>

<template>
  <Field>
    <FieldLabel for="group-story-status">Status</FieldLabel>
    <select
      id="group-story-status"
      v-model="metadata.storyStatus"
      name="storyStatus"
      :class="selectClass"
    >
      <option v-for="status in STATUS_LABELS" :key="status.value" :value="status.value">
        {{ status.label }}
      </option>
    </select>
  </Field>

  <StoryVocabularyFields v-model="vocabulary" id-prefix="group" />

  <Field>
    <FieldLabel for="group-language">Sprache</FieldLabel>
    <select id="group-language" v-model="metadata.language" name="language" :class="selectClass">
      <option v-for="(label, value) in LANGUAGE_LABELS" :key="value" :value="value">
        {{ label }}
      </option>
    </select>
  </Field>
</template>
