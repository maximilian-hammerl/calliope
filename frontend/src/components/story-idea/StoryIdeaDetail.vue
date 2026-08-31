<script setup lang="ts">
import { computed } from 'vue'
import type { GetStoryIdea200 } from '@/api/models'
import { formatActivityTime } from '@/lib/format/formatTime'
import { paragraphs } from '@/lib/format/formatText'
import {
  PERSPECTIVE_LABELS,
  TENSE_LABELS,
  contentWarningLine,
  genreLine,
  subgenreLine,
  tropeLine,
} from '@/lib/story/storyVocabulary'
import {
  IDEA_STATUS_ICONS,
  IDEA_STATUS_LABELS,
  LANGUAGE_LABELS,
  PARTY_SIZE_LABELS,
  readToggle,
} from '@/lib/format/storyIdea'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import FavouriteToggle from '@/components/favourite/FavouriteToggle.vue'
import { useStoryIdeaActions } from '@/composables/useStoryIdeaActions'
import { Button } from '@/components/ui/button'
import { Flag, MessageCircle, Pencil, Plus, Trash2 } from '@lucide/vue'

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

/**
 * The actions live here rather than in a slot, and the slot is gone rather than left as an override:
 * both callers filled it themselves and drifted, and a seam left open is the one that gets used.
 *
 * What a caller still decides is what to refetch, which genuinely differs, so those are emits. The
 * dialogs stay with the callers too — the carousel keys its report dialog by id.
 */
const emit = defineEmits<{
  readChanged: [isRead: boolean]
  favouriteChanged: [isFavourite: boolean]
  report: []
  edit: []
  remove: []
  foundGroup: []
}>()

const { savingRead, changeRead, startingConversation, conversationError, askAboutIdea } =
  useStoryIdeaActions()

async function markRead(isRead: boolean) {
  await changeRead(props.idea.id, isRead)
  emit('readChanged', isRead)
}

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
    { label: 'Genre', value: genreLine(props.idea.genres) },
    { label: 'Subgenre', value: subgenreLine(props.idea.subgenres) },
    { label: 'Tropes', value: tropeLine(props.idea.tropes) },
    { label: 'Themen', value: props.idea.storyThemes ?? undefined },
    { label: 'Schauplätze', value: props.idea.storySettings ?? undefined },
    {
      label: 'Zeitform',
      value: props.idea.tense === null ? undefined : TENSE_LABELS[props.idea.tense],
    },
    {
      label: 'Perspektive',
      value:
        props.idea.perspective === null ? undefined : PERSPECTIVE_LABELS[props.idea.perspective],
    },
    { label: 'Inhaltswarnungen', value: contentWarningLine(props.idea.contentWarnings) },
  ].filter((entry): entry is { label: string; value: string } => entry.value !== undefined)
})
</script>

<template>
  <div class="flex flex-wrap items-baseline gap-3">
    <component :is="heading" class="text-h1 text-ink-1">
      {{ idea.title }}
      <CalliopeBadge class="ml-3 inline-flex items-center gap-1.5">
        <!-- Decorative: the word beside it is the accessible name already. This page is where
             the word teaches the mark the row shows on its own. -->
        <component
          :is="IDEA_STATUS_ICONS[idea.status]"
          :size="13"
          :stroke-width="1.5"
          aria-hidden="true"
        />
        {{ IDEA_STATUS_LABELS[idea.status] }}
      </CalliopeBadge>
    </component>

    <div class="ml-auto flex flex-wrap items-center gap-2">
      <!-- Outside the author/visitor split, because favouriting one's own idea is allowed:
           keeping your own thing at the top of your own list is ordinary. -->
      <FavouriteToggle
        target-type="story_idea"
        :target-id="idea.id"
        :is-favourite="idea.isFavourite"
        @changed="(isFavourite) => emit('favouriteChanged', isFavourite)"
      />

      <template v-if="own">
        <Button variant="outline" size="sm" @click="emit('foundGroup')">
          <Plus :stroke-width="1.5" />
          Gruppe gründen
        </Button>
        <Button variant="outline" size="sm" @click="emit('edit')">
          <Pencil :stroke-width="1.5" />
          Bearbeiten
        </Button>
        <Button variant="outline" size="sm" @click="emit('remove')">
          <Trash2 :stroke-width="1.5" />
          Löschen
        </Button>
      </template>

      <template v-else>
        <!-- Choosing the state an idea already has clears it, which is why the label names the
             state rather than the act. -->
        <Button
          v-for="toggle in [readToggle(idea.isRead)]"
          :key="toggle.title"
          variant="outline"
          size="sm"
          :title="toggle.title"
          :disabled="savingRead"
          @click="markRead(toggle.next)"
        >
          <!-- From `readToggle`, the same glyph `ReadMark` shows in a row. Decorative — the label
               beside it already names the state. -->
          <component :is="toggle.icon" :stroke-width="1.5" aria-hidden="true" />
          {{ toggle.label }}
        </Button>
        <!-- Quiet like its neighbours: a level says what an act is on, and this is on the idea.
             Placement is what keeps reporting from competing. -->
        <Button variant="outline" size="sm" @click="emit('report')">
          <Flag :stroke-width="1.5" aria-hidden="true" />
          Melden
        </Button>
        <!-- Disabled rather than hidden on a closed idea: the endpoint answers 403, and a member
             who kept the idea should see why they cannot write. Inert in the carousel, whose set
             is open ideas only — but the rule belongs to the idea, not to the page. -->
        <Button
          size="sm"
          :disabled="startingConversation || idea.status === 'closed'"
          :title="
            idea.status === 'closed'
              ? 'Diese Storyidee ist geschlossen und kann nicht mehr beantwortet werden'
              : undefined
          "
          @click="askAboutIdea(idea.id)"
        >
          <MessageCircle :stroke-width="1.5" />
          Chat beginnen
        </Button>
      </template>
    </div>
  </div>

  <p v-if="idea.status === 'closed'" class="mt-3 max-w-[60ch] text-row text-ink-5">
    Diese Storyidee ist geschlossen. Sie bleibt lesbar, aber
    {{ own ? 'niemand kann sie mehr beantworten' : 'du kannst sie nicht mehr beantworten' }}.
  </p>

  <p v-if="idea.subtitle" class="mt-1 max-w-[60ch] text-note text-ink-3">
    {{ idea.subtitle }}
  </p>

  <p v-if="conversationError" class="mt-3 text-[12.5px] text-destructive" role="alert">
    {{ conversationError }}
  </p>

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
