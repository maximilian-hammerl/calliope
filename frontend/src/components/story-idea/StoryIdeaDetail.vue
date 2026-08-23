<script setup lang="ts">
import { computed } from 'vue'
import type { GetStoryIdea200 } from '@/api/models'
import { formatActivityTime } from '@/lib/format/formatTime'
import { paragraphs } from '@/lib/format/formatText'
import { tagLine } from '@/lib/format/storyTags'
import { IDEA_STATUS_LABELS, LANGUAGE_LABELS, PARTY_SIZE_LABELS } from '@/lib/format/storyIdea'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'

const props = withDefaults(
  defineProps<{
    idea: GetStoryIdea200
    /** `h2` in the carousel, where three slides would otherwise each claim to be the page. */
    heading?: 'h1' | 'h2'
    /** Whether the reader wrote it, which changes only what the closed notice says. */
    own?: boolean
  }>(),
  { heading: 'h1', own: false },
)

/** The long version, as the paragraphs its author typed. */
const synopsis = computed<string[]>(() => paragraphs(props.idea.synopsis))

/** The seeking block, only the lines that were filled in. */
const seeking = computed<Array<{ label: string; value: string }>>(() =>
  [
    { label: 'Gesucht', value: props.idea.lookingFor ?? undefined },
    {
      label: 'Konstellation',
      value: props.idea.partySize ? PARTY_SIZE_LABELS[props.idea.partySize] : undefined,
    },
    { label: 'Sprache', value: LANGUAGE_LABELS[props.idea.language] },
  ].filter((entry): entry is { label: string; value: string } => entry.value !== undefined),
)

/** The story block, mirroring the group's reference card. */
const story = computed<Array<{ label: string; value: string }>>(() => {
  return [
    { label: 'Genre', value: tagLine(props.idea.genres) },
    { label: 'Subgenre', value: tagLine(props.idea.subgenres) },
    { label: 'Tropes', value: tagLine(props.idea.tropes) },
    { label: 'Zeitform', value: props.idea.tense ?? undefined },
    { label: 'Perspektive', value: props.idea.perspective ?? undefined },
    { label: 'Inhaltswarnungen', value: tagLine(props.idea.contentWarnings) },
  ].filter((entry): entry is { label: string; value: string } => entry.value !== undefined)
})
</script>

<template>
  <div class="flex flex-wrap items-baseline gap-3">
    <component :is="heading" class="text-h1 text-ink-1">
      {{ idea.title }}
      <CalliopeBadge class="ml-3">{{ IDEA_STATUS_LABELS[idea.status] }}</CalliopeBadge>
    </component>

    <div class="ml-auto flex flex-wrap items-center gap-2">
      <slot name="actions" />
    </div>
  </div>

  <p v-if="idea.status === 'closed'" class="mt-3 max-w-[60ch] text-row text-ink-5">
    Diese Storyidee ist geschlossen. Sie bleibt lesbar, aber
    {{ own ? 'niemand kann sie mehr beantworten' : 'du kannst sie nicht mehr beantworten' }}.
  </p>

  <p v-if="idea.subtitle" class="mt-1 max-w-[60ch] text-note text-ink-3">
    {{ idea.subtitle }}
  </p>

  <slot name="notices" />

  <div class="mt-2 text-[12.5px] text-ink-5">
    von
    <RouterLink
      :to="{ name: 'member', params: { userId: idea.createdBy } }"
      class="underline-offset-[6px] hover:underline"
    >
      {{ idea.createdByUsername }}
    </RouterLink>
    · {{ formatActivityTime(idea.createdAt) }}
  </div>

  <!-- The short version leads, because members write it as the opening of the long one rather
       than a summary of it — so the two read as one text. -->
  <p class="prose-post mt-6 max-w-[60ch] font-medium">{{ idea.teaser }}</p>

  <div class="mt-[0.9em] flex max-w-[60ch] flex-col gap-[0.9em]">
    <p v-for="(paragraph, index) in synopsis" :key="index" class="prose-post">
      {{ paragraph }}
    </p>
  </div>

  <div class="mt-8 grid max-w-[60ch] grid-cols-1 gap-8 border-t border-line-3 pt-6 sm:grid-cols-2">
    <div v-if="seeking.length > 0">
      <div class="mb-2.5 text-[12.5px] font-semibold text-ink-4">Die Suche</div>
      <div class="text-rail text-ink-4">
        <div v-for="entry in seeking" :key="entry.label">
          <span class="text-ink-6">{{ entry.label }}:&nbsp;</span>
          <span>{{ entry.value }}</span>
        </div>
      </div>
    </div>

    <div v-if="story.length > 0">
      <div class="mb-2.5 text-[12.5px] font-semibold text-ink-4">Die Geschichte</div>
      <div class="text-rail text-ink-4">
        <div v-for="entry in story" :key="entry.label">
          <span class="text-ink-6">{{ entry.label }}:&nbsp;</span>
          <span>{{ entry.value }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
