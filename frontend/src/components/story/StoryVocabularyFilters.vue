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
  emptySelection,
  subgenresFor,
} from '@/lib/story/storyVocabulary'
import type { Genre, StoryVocabularySelection, Subgenre, Trope } from '@/lib/story/storyVocabulary'
import ChoiceChips from '@/components/common/ChoiceChips.vue'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'

const selection = defineModel<StoryVocabularySelection>({ required: true })

const options = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as Array<[T, string]>).map(([value, label]) => ({ value, label }))

const GENRE_OPTIONS = options(GENRE_LABELS)
const TROPE_OPTIONS = options(TROPE_LABELS)

const subgenreOptions = computed(() => subgenresFor(selection.value.genres))

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

/** Written once: three items styling their own trigger is how two of them end up disagreeing. */
const TRIGGER = 'flex-row-reverse justify-end gap-1.5 py-2 text-note hover:no-underline'
const CONTENT = 'pt-1 pb-2'

const chosenCount = computed<number>(
  () =>
    selection.value.genres.length +
    selection.value.subgenres.length +
    selection.value.tropes.length,
)
</script>

<template>
  <!--
    One accordion rather than three, so the three sections share a set of hairlines instead of
    each floating its own chevron — and `multiple`, because they narrow together rather than
    replacing each other.

    Genres and subgenres open, tropes shut. Genre is the field members named unprompted and the
    one §8.2 filters by, where a trope was named by nobody; thirty-one chips are also four rows,
    which pushed the search field and the list itself off the screen.
  -->
  <Accordion
    type="multiple"
    as="div"
    :default-value="['genres', 'subgenres']"
    class="flex flex-col"
  >
    <AccordionItem value="genres" class="border-b-0">
      <AccordionTrigger :class="TRIGGER">
        <span class="flex items-baseline gap-2">
          Genres
          <span v-if="genres.length > 0" class="font-normal text-ink-5">
            {{ genres.length }} gewählt
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent :class="CONTENT">
        <ChoiceChips v-model="genres" :options="GENRE_OPTIONS" label="Nach Genre filtern" />
      </AccordionContent>
    </AccordionItem>

    <!-- Absent until a genre is: a subgenre has nothing to sit under otherwise. -->
    <AccordionItem v-if="subgenreOptions.length > 0" value="subgenres" class="border-b-0">
      <AccordionTrigger :class="TRIGGER">
        <span class="flex items-baseline gap-2">
          Subgenres
          <span v-if="subgenres.length > 0" class="font-normal text-ink-5">
            {{ subgenres.length }} gewählt
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent :class="CONTENT">
        <ChoiceChips v-model="subgenres" :options="subgenreOptions" label="Nach Subgenre filtern" />
      </AccordionContent>
    </AccordionItem>

    <AccordionItem value="tropes" class="border-b-0">
      <AccordionTrigger :class="TRIGGER">
        <span class="flex items-baseline gap-2">
          Tropes
          <span v-if="tropes.length > 0" class="font-normal text-ink-5">
            {{ tropes.length }} gewählt
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent :class="CONTENT">
        <ChoiceChips v-model="tropes" :options="TROPE_OPTIONS" label="Nach Trope filtern" />
      </AccordionContent>
    </AccordionItem>

    <!-- Only once something is set: a control that does nothing is one more thing to read past. -->
    <div v-if="chosenCount > 0" class="pt-3">
      <Button variant="outline" size="sm" @click="selection = emptySelection()">
        Filter zurücksetzen
      </Button>
    </div>
  </Accordion>
</template>
