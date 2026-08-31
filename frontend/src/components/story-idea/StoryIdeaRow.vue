<script setup lang="ts">
import { computed } from 'vue'
import {
  GENRE_LABELS,
  PERSPECTIVE_LABELS,
  SUBGENRE_LABELS,
  TENSE_LABELS,
  TROPE_LABELS,
} from '@/lib/story/storyVocabulary'
import type { ListStoryIdeas200ResultsItem } from '@/api/models'
import { formatActivityTime } from '@/lib/format/formatTime'
import { LANGUAGE_LABELS } from '@/lib/format/storyIdea'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import ClosedMark from '@/components/story-idea/ClosedMark.vue'
import FavouriteMark from '@/components/favourite/FavouriteMark.vue'
import ReadMark from '@/components/story-idea/ReadMark.vue'

const props = defineProps<{ idea: ListStoryIdeas200ResultsItem }>()

/**
 * What the story is, in one line. Genres before subgenres before tropes, because that is
 * narrowing order, and the narrative style last — a reader scanning a board is choosing a
 * kind of story before they care what tense it is in. Empty fields are left out rather than
 * labelled, so a sparse idea reads as short instead of unfinished.
 */
const story = computed<string>(() =>
  [
    ...props.idea.genres.map((genre) => GENRE_LABELS[genre]),
    ...props.idea.subgenres.map((subgenre) => SUBGENRE_LABELS[subgenre]),
    ...props.idea.tropes.map((trope) => TROPE_LABELS[trope]),
    props.idea.tense === null ? undefined : TENSE_LABELS[props.idea.tense],
    props.idea.perspective === null ? undefined : PERSPECTIVE_LABELS[props.idea.perspective],
  ]
    .filter((entry) => entry !== undefined)
    .join(' · '),
)
</script>

<template>
  <div class="py-[26px]">
    <div class="text-h2">
      <RouterLink
        :to="{ name: 'storyIdea', params: { ideaId: idea.id } }"
        class="text-ink-1 underline-offset-[6px] hover:underline"
      >
        {{ idea.title }}
      </RouterLink>
      <!-- Open is the board's resting state and says nothing; the others are worth a mark. -->
      <ClosedMark v-if="idea.status !== 'open'" class="ml-3" />
      <!-- The reader's own two states, as marks rather than words: the idea's own status keeps
           the badge, so the row reads as one fact about the idea and then what you did with it. -->
      <ReadMark v-if="idea.isRead" class="ml-3" />
      <FavouriteMark v-if="idea.isFavourite" class="ml-2" />
      <CalliopeBadge v-if="idea.language !== 'german'" class="ml-3">
        {{ LANGUAGE_LABELS[idea.language] }}
      </CalliopeBadge>
    </div>

    <p v-if="idea.subtitle" class="mt-1 max-w-[60ch] text-note text-ink-3">
      {{ idea.subtitle }}
    </p>

    <p class="mt-1.5 line-clamp-3 max-w-[60ch] text-row text-ink-4">
      {{ idea.teaser }}
    </p>

    <div v-if="story !== ''" class="mt-2 max-w-[60ch] text-[12.5px] leading-[1.6] text-ink-5">
      {{ story }}
    </div>

    <!-- Its own line, and named: a content warning is something a reader looks for before
         deciding to read, not one tag among the others. -->
    <div
      v-if="idea.contentWarnings.length > 0"
      class="mt-0.5 max-w-[60ch] text-[12.5px] leading-[1.6] text-ink-5"
    >
      <span class="text-ink-6">Inhaltswarnungen:&nbsp;</span>{{ idea.contentWarnings.join(', ') }}
    </div>

    <div class="mt-1.5 text-rail text-ink-5">
      von
      <RouterLink
        :to="{ name: 'member', params: { userId: idea.createdBy } }"
        class="underline-offset-[6px] hover:underline"
      >
        {{ idea.createdByUsername }}
      </RouterLink>
      · {{ formatActivityTime(idea.createdAt) }}
    </div>
  </div>
</template>
