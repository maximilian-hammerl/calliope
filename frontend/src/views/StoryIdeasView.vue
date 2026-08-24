<script setup lang="ts">
/**
 * The board (§8). One view for both destinations: "entdecken" is everything still answerable,
 * `mine` is the member's own ideas regardless of status — closing one must not hide it from
 * its author.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { watchDebounced } from '@vueuse/core'
import { keepPreviousData } from '@tanstack/vue-query'
import { Plus } from '@lucide/vue'
import { useListStoryIdeas } from '@/api/story-ideas/story-ideas'
import type { ListStoryIdeas200ResultsItem } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import { IDEA_STATUS_LABELS } from '@/lib/format/storyIdea'
import { usePagedList } from '@/composables/usePagedList'
import FilterStrip from '@/components/common/FilterStrip.vue'
import ListPagination from '@/components/common/ListPagination.vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import StoryIdeaDialog from '@/components/story-idea/StoryIdeaDialog.vue'
import StoryIdeaRow from '@/components/story-idea/StoryIdeaRow.vue'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const props = defineProps<{ mine?: boolean }>()

const LIMIT = TEXT_LIMIT.listStoryIdeas.search

/** Ten to a page, as everywhere a list is hunted through rather than read. */
const IDEAS_PER_PAGE = 10

/**
 * Only on the discovery board: a member cannot mark their own idea, so the filter would have
 * nothing to act on under `mine`.
 *
 * Defaults to `unread`, which is what the filter is for — reading what has not been read.
 * The endpoint's own default is `any`, so no other caller inherits this choice.
 */
const readerState = ref<'unread' | 'read' | 'any'>('unread')

/**
 * Explicit rather than inferred from the reading filter: a member who removes a mark from a
 * closed idea has to be able to find it again, and a board that widened itself silently would
 * leave them no way to ask.
 */
const status = ref<'open' | 'closed' | 'any'>('open')

const STATUS_FILTERS = [
  { value: 'open', label: IDEA_STATUS_LABELS.open },
  { value: 'closed', label: IDEA_STATUS_LABELS.closed },
  { value: 'any', label: 'Alle' },
] as const

const READER_STATE_FILTERS = [
  { value: 'unread', label: 'Ungelesen' },
  { value: 'read', label: 'Gelesen' },
  { value: 'any', label: 'Alle' },
] as const

const term = ref<string>('')
const settled = ref<string>('')
const trimmed = computed<string>(() => term.value.trim())

watchDebounced(
  trimmed,
  (value) => {
    settled.value = value.length >= LIMIT.minLength ? value : ''
  },
  { debounce: 300 },
)

// Before the query: the request needs `offset` while its key is built, and the total it pages
// over comes back from that same query, so the composable reads the total lazily.
const { page, offset, pageCount, goToPage } = usePagedList(IDEAS_PER_PAGE, () => totalResults.value)

// A search or a filter narrows the board, so whatever page was open is about a different set.
watch([settled, readerState, status], () => goToPage(1))

const { data, isPending, isError } = useListStoryIdeas(
  () => ({
    limit: IDEAS_PER_PAGE,
    offset: offset.value,
    author: props.mine ? ('mine' as const) : ('others' as const),
    readerState: props.mine ? ('any' as const) : readerState.value,
    status: props.mine ? undefined : status.value,
    search: settled.value === '' ? undefined : settled.value,
  }),
  { query: { placeholderData: keepPreviousData } },
)

const totalResults = computed<number | undefined>(() =>
  data.value?.status === 200 ? data.value.data.totalResults : undefined,
)

const ideas = computed<ListStoryIdeas200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)

const hasLoaded = computed<boolean>(() => data.value?.status === 200)

const router = useRouter()

function openIdea(ideaId: string) {
  void router.push({ name: 'storyIdea', params: { ideaId } })
}

const creating = ref<boolean>(false)
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-gutter py-5 pb-8 md:px-10">
      <div class="mb-2 flex flex-wrap items-baseline gap-3">
        <h1 class="text-h1 text-ink-1">
          {{ props.mine ? 'Meine Storyideen' : 'Storyideen entdecken' }}
        </h1>

        <div class="ml-auto">
          <Button
            variant="outline"
            size="sm"
            aria-label="Storyidee vorstellen"
            @click="creating = true"
          >
            <Plus :stroke-width="1.5" />
            Storyidee
          </Button>
        </div>
      </div>

      <p class="mb-6 max-w-[60ch] text-body text-ink-4">
        <template v-if="props.mine">
          Deine Ideen, auch die abgeschlossenen. Ändere ihren Status, wenn sich etwas tut.
        </template>
        <template v-else>
          Ideen, die Mitschreibende suchen. Gefällt dir eine, sieh dir das Profil dazu an.
        </template>
      </p>

      <!-- One grid for both strips, so the labels share a column and the strips align. -->
      <div
        v-if="hasLoaded && !mine"
        class="mb-6 flex flex-col gap-4 md:grid md:grid-cols-[max-content_1fr] md:items-end md:gap-x-4 md:gap-y-1"
      >
        <FilterStrip
          v-model="readerState"
          label="Gelesen oder nicht"
          :options="READER_STATE_FILTERS"
        />
        <FilterStrip v-model="status" label="Offen oder geschlossen" :options="STATUS_FILTERS" />
      </div>

      <Field v-if="hasLoaded" class="mb-7 max-w-[380px]">
        <FieldLabel for="ideas-search">Suche</FieldLabel>
        <Input
          id="ideas-search"
          v-model="term"
          name="search"
          type="search"
          placeholder="z. B. Leuchtturm"
          :maxlength="LIMIT.maxLength"
          autocomplete="off"
          spellcheck="false"
        />
        <FieldDescription>
          Sucht in Titeln und Ideen, ab {{ LIMIT.minLength }} Zeichen.
        </FieldDescription>
      </Field>

      <p v-if="hasLoaded && ideas.length === 0" class="max-w-[46ch] text-body text-ink-4">
        <template v-if="settled !== ''">Keine Idee passt zu „{{ settled }}“.</template>
        <template v-else-if="props.mine"> Du hast noch keine Storyidee vorgestellt. </template>
        <!-- Without these the filters' own emptiness would read as an empty board. The
             default view avoids claiming why it is empty: nothing unread and nothing at all
             look the same from here, and only one of them would be true. -->
        <template v-else-if="readerState === 'unread' && status === 'open'">
          Hier ist gerade nichts Ungelesenes. Unter „Gelesen“ und „Gemerkt“ findest du, was du schon
          kennst.
        </template>
        <template v-else-if="readerState !== 'any' || status !== 'any'">
          Keine Idee passt zu diesen Filtern.
        </template>
        <template v-else>
          Im Moment sucht keine Idee nach Mitschreibenden. Stell deine vor.
        </template>
      </p>

      <div v-else-if="hasLoaded">
        <StoryIdeaRow
          v-for="(idea, index) in ideas"
          :key="idea.id"
          :idea="idea"
          :class="index > 0 ? 'border-t border-line-2' : 'pt-0'"
        />
      </div>

      <div v-if="hasLoaded && pageCount > 1" class="mt-7 border-t border-line-2 pt-3">
        <ListPagination :page="page" :page-count="pageCount" @go="goToPage" />
      </div>

      <p v-else-if="isPending" class="text-[12.5px] text-ink-5">Ideen werden geladen …</p>

      <p v-else-if="isError" class="text-[12.5px] text-ink-5">
        Die Ideen lassen sich gerade nicht laden. Versuche es später noch einmal.
      </p>
    </div>
  </AppLayout>

  <StoryIdeaDialog v-model:open="creating" @saved="openIdea" />
</template>
