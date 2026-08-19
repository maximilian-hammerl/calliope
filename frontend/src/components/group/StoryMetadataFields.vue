<script setup lang="ts">
/**
 * The story's metadata, shared by the create and the edit dialog so the two cannot drift —
 * which is exactly what went wrong before: the create dialog offered Genre and Perspektive,
 * the edit dialog did not, and neither actually stored anything.
 */
import { TEXT_LIMIT } from '@/api/textLimit'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export type StoryMetadata = {
  subtitle: string
  storyStatus: 'planning' | 'writing' | 'finished'
  genres: string
  subgenres: string
  tropes: string
  contentWarnings: string
  tense: string
  perspective: string
}

const metadata = defineModel<StoryMetadata>({ required: true })

const LIMIT = TEXT_LIMIT.createGroup

const STATUS_LABELS = [
  { value: 'planning', label: 'In Planung' },
  { value: 'writing', label: 'Wird geschrieben' },
  { value: 'finished', label: 'Abgeschlossen' },
] as const

// Every one of these is optional. Members told us Yooco's mandatory profile section got filled
// with nonsense purely to get past it, so nothing here blocks creating a group.
const TAG_FIELDS = [
  { key: 'genres', label: 'Genres', placeholder: 'z. B. Fantasy, Mystery' },
  { key: 'subgenres', label: 'Subgenres', placeholder: 'z. B. Cyberpunk, Dark Romance' },
  { key: 'tropes', label: 'Tropes', placeholder: 'z. B. Enemies to Lovers, Found Family' },
  {
    key: 'contentWarnings',
    label: 'Inhaltswarnungen',
    placeholder: 'z. B. Gewalt, Trauer',
  },
] as const
</script>

<template>
  <Field>
    <FieldLabel for="group-subtitle">Untertitel</FieldLabel>
    <Input
      id="group-subtitle"
      v-model="metadata.subtitle"
      class="h-11 md:h-9"
      name="subtitle"
      :maxlength="LIMIT.subtitle.maxLength"
      placeholder="z. B. Was du vergisst, gehört jemand anderem"
    />
  </Field>

  <Field>
    <FieldLabel for="group-story-status">Status</FieldLabel>
    <select
      id="group-story-status"
      v-model="metadata.storyStatus"
      name="storyStatus"
      class="h-11 w-full rounded-lg border border-line-4 bg-paper-0 px-[11px] text-[13.5px] text-ink-2 md:h-9"
    >
      <option v-for="status in STATUS_LABELS" :key="status.value" :value="status.value">
        {{ status.label }}
      </option>
    </select>
  </Field>

  <Field v-for="field in TAG_FIELDS" :key="field.key">
    <FieldLabel :for="`group-${field.key}`">{{ field.label }}</FieldLabel>
    <Input
      :id="`group-${field.key}`"
      v-model="metadata[field.key]"
      class="h-11 md:h-9"
      :name="field.key"
      :placeholder="field.placeholder"
    />
    <FieldDescription>Mit Komma trennen.</FieldDescription>
  </Field>

  <Field>
    <FieldLabel for="group-tense">Zeitform</FieldLabel>
    <Input
      id="group-tense"
      v-model="metadata.tense"
      class="h-11 md:h-9"
      name="tense"
      :maxlength="LIMIT.tense.maxLength"
      placeholder="z. B. Vergangenheit"
    />
  </Field>

  <Field>
    <FieldLabel for="group-perspective">Perspektive</FieldLabel>
    <Input
      id="group-perspective"
      v-model="metadata.perspective"
      class="h-11 md:h-9"
      name="perspective"
      :maxlength="LIMIT.perspective.maxLength"
      placeholder="z. B. Dritte Person, begrenzt"
    />
  </Field>
</template>
