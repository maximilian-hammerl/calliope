<script setup lang="ts">
/**
 * Narrows a board by genre, subgenre and trope. The point of #75: over free text these were three
 * spellings of one trope and no filter was possible.
 *
 * Genres are always on screen because that is the field members named unprompted and the one §8.2
 * filters by — a filter nobody finds is the mistake discovery already made once, when it was a
 * text link below the list. Subgenres appear only once a genre is chosen, which is the same gating
 * the form uses and what keeps seventy-six values from ever being a wall.
 */
import { computed } from 'vue'
import {
  GENRE_LABELS,
  TROPE_LABELS,
  afterChoosingGenres,
  subgenresFor,
} from '@/lib/story/storyVocabulary'
import type { Genre, StoryVocabularySelection, Subgenre, Trope } from '@/lib/story/storyVocabulary'
import ChoiceChips from '@/components/common/ChoiceChips.vue'
import FilterSection from '@/components/common/FilterSection.vue'

const selection = defineModel<StoryVocabularySelection>({ required: true })

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as Array<[T, string]>).map(([value, label]) => ({ value, label }))

const GENRE_OPTIONS = options(GENRE_LABELS)
const TROPE_OPTIONS = options(TROPE_LABELS)

const subgenreOptions = computed(() => subgenresFor(selection.value.genres))

/** Absent when nothing is chosen, so the label says nothing rather than „0 gewählt". */
const chosenText = (count: number): string | undefined =>
  count === 0 ? undefined : `${count} gewählt`

const genres = computed<Genre[]>({
  get: () => selection.value.genres,
  set: (chosen) => (selection.value = afterChoosingGenres(selection.value, chosen)),
})

const subgenres = computed<Subgenre[]>({
  get: () => selection.value.subgenres,
  set: (chosen) => (selection.value = { ...selection.value, subgenres: chosen }),
})

const tropes = computed<Trope[]>({
  get: () => selection.value.tropes,
  set: (chosen) => (selection.value = { ...selection.value, tropes: chosen }),
})
</script>

<template>
  <!--
    Each vocabulary is a `FilterSection` like every other filter on the page, so the label, the
    disclosure and the shared column are one implementation rather than two that drift.
  -->
  <FilterSection label="Genres" :chosen="chosenText(genres.length)">
    <ChoiceChips v-model="genres" :options="GENRE_OPTIONS" label="Nach Genre filtern" />
  </FilterSection>

  <!-- Absent until a genre is: a subgenre has nothing to sit under otherwise. -->
  <FilterSection
    v-if="subgenreOptions.length > 0"
    label="Subgenres"
    :chosen="chosenText(subgenres.length)"
  >
    <ChoiceChips v-model="subgenres" :options="subgenreOptions" label="Nach Subgenre filtern" />
  </FilterSection>

  <FilterSection label="Tropes" :chosen="chosenText(tropes.length)" initially-shut>
    <ChoiceChips v-model="tropes" :options="TROPE_OPTIONS" label="Nach Trope filtern" />
  </FilterSection>
</template>
