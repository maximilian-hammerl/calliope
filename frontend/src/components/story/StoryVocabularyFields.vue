<script setup lang="ts">
/**
 * The story vocabularies, shared by the group dialog and the story-idea dialog so the two cannot
 * drift — which is exactly what went wrong before: the create dialog offered Genre and
 * Perspektive, the edit dialog did not, and neither actually stored anything.
 *
 * Status and language are not here: a group's story status and an idea's open/closed status are
 * different things, and each dialog owns its own.
 *
 * Chosen rather than typed since #75: a filter over free text is no filter, and „Enemies to
 * Lovers", „enemies-to-lovers" and „Enemies To Lovers" were three tropes to a query. Themes and
 * settings stayed free text on purpose — beta testers added nothing to either list and asked for
 * a plain field, so those two describe rather than filter.
 */
import { computed } from 'vue'
import {
  CONTENT_WARNING_LABELS,
  afterChoosingGenres,
  GENRE_LABELS,
  PERSPECTIVE_LABELS,
  TENSE_LABELS,
  TROPE_LABELS,
  subgenresFor,
} from '@/lib/story/storyVocabulary'
import type {
  ContentWarning,
  Genre,
  Perspective,
  Subgenre,
  Tense,
  Trope,
} from '@/lib/story/storyVocabulary'
import ChoiceChips from '@/components/common/ChoiceChips.vue'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

export type StoryVocabulary = {
  genres: Genre[]
  subgenres: Subgenre[]
  tropes: Trope[]
  contentWarnings: ContentWarning[]
  storyThemes: string
  storySettings: string
  /** Empty string for "not said", which is what a select's placeholder option carries. */
  tense: Tense | ''
  perspective: Perspective | ''
}

const metadata = defineModel<StoryVocabulary>({ required: true })

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as Array<[T, string]>).map(([value, label]) => ({ value, label }))

const GENRE_OPTIONS = options(GENRE_LABELS)
const TROPE_OPTIONS = options(TROPE_LABELS)
const CONTENT_WARNING_OPTIONS = options(CONTENT_WARNING_LABELS)

/**
 * Only the subgenres of the genres actually picked — eight at most instead of seventy-six. Choosing
 * a genre is what opens them, which is also why a subgenre already chosen is dropped when its
 * genre goes: it would otherwise be stored while being invisible to the person who set it.
 */
const subgenreOptions = computed(() => subgenresFor(metadata.value.genres))

const genres = computed<Genre[]>({
  get: () => metadata.value.genres,
  set: (chosen) => (metadata.value = afterChoosingGenres(metadata.value, chosen)),
})

const props = defineProps<{ idPrefix: string }>()

const selectClass =
  'h-11 w-full rounded-lg border border-line-4 bg-paper-0 px-[11px] text-[13.5px] text-ink-2 md:h-9'
</script>

<template>
  <Field>
    <FieldLabel optional>Genres</FieldLabel>
    <ChoiceChips v-model="genres" :options="GENRE_OPTIONS" label="Genres" />
  </Field>

  <!-- Absent until a genre is, because a subgenre without its genre has nothing to sit under. -->
  <Field v-if="subgenreOptions.length > 0">
    <FieldLabel optional>Subgenres</FieldLabel>
    <ChoiceChips v-model="metadata.subgenres" :options="subgenreOptions" label="Subgenres" />
  </Field>

  <Field>
    <FieldLabel optional>Tropes</FieldLabel>
    <ChoiceChips v-model="metadata.tropes" :options="TROPE_OPTIONS" label="Tropes" />
  </Field>

  <Field>
    <FieldLabel optional>Inhaltswarnungen</FieldLabel>
    <ChoiceChips
      v-model="metadata.contentWarnings"
      :options="CONTENT_WARNING_OPTIONS"
      label="Inhaltswarnungen"
    />
    <FieldDescription>Damit andere wissen, worauf sie sich einlassen.</FieldDescription>
  </Field>

  <!-- Written rather than chosen: see the note at the top. No maxlength, like every prose field. -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <Field>
      <FieldLabel optional for="`${props.idPrefix}-story-themes`">Themen</FieldLabel>
      <Textarea
        id="`${props.idPrefix}-story-themes`"
        v-model="metadata.storyThemes"
        name="storyThemes"
        rows="2"
      />
      <FieldDescription>Worum es unter der Handlung geht.</FieldDescription>
    </Field>

    <Field>
      <FieldLabel optional :for="`${props.idPrefix}-story-settings`">Schauplätze</FieldLabel>
      <Textarea
        :id="`${props.idPrefix}-story-settings`"
        v-model="metadata.storySettings"
        name="storySettings"
        rows="2"
      />
      <FieldDescription>Wo die Geschichte spielt.</FieldDescription>
    </Field>
  </div>

  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
    <Field>
      <FieldLabel optional :for="`${props.idPrefix}-tense`">Zeitform</FieldLabel>
      <select
        :id="`${props.idPrefix}-tense`"
        v-model="metadata.tense"
        name="tense"
        :class="selectClass"
      >
        <option value="">Keine Angabe</option>
        <option v-for="(label, value) in TENSE_LABELS" :key="value" :value="value">
          {{ label }}
        </option>
      </select>
    </Field>

    <Field>
      <FieldLabel optional :for="`${props.idPrefix}-perspective`">Perspektive</FieldLabel>
      <select
        :id="`${props.idPrefix}-perspective`"
        v-model="metadata.perspective"
        name="perspective"
        :class="selectClass"
      >
        <option value="">Keine Angabe</option>
        <option v-for="(label, value) in PERSPECTIVE_LABELS" :key="value" :value="value">
          {{ label }}
        </option>
      </select>
    </Field>
  </div>
</template>
