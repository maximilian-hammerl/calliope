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
import { FAVOURITE_FILTER_LABELS } from '@/lib/format/favourite'
import { usePagedList } from '@/composables/usePagedList'
import FilterStrip from '@/components/common/FilterStrip.vue'
import FilterStrips from '@/components/common/FilterStrips.vue'
import StoryVocabularyFilters from '@/components/story/StoryVocabularyFilters.vue'
import FilterReset from '@/components/common/FilterReset.vue'
import { emptySelection, isNarrowed } from '@/lib/story/storyVocabulary'
import type { StoryVocabularySelection } from '@/lib/story/storyVocabulary'
import StoryIdeasViewStrip from '@/components/story-idea/StoryIdeasViewStrip.vue'
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

/**
 * Offered on both boards, unlike the reading filter: a member's own ideas cannot be unread, but
 * they can certainly be favourites.
 */
const favourite = ref<'any' | 'only'>('any')

const STATUS_FILTERS = [
  { value: 'open', label: IDEA_STATUS_LABELS.open },
  { value: 'closed', label: IDEA_STATUS_LABELS.closed },
  { value: 'any', label: 'Alle' },
] as const

const FAVOURITE_FILTERS = [
  { value: 'any', label: FAVOURITE_FILTER_LABELS.any },
  { value: 'only', label: FAVOURITE_FILTER_LABELS.only },
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
const { page, offset, total, itemsPerPage, pageCount, goToPage } = usePagedList(
  IDEAS_PER_PAGE,
  () => totalResults.value,
)

/** Absent rather than empty, so an untouched filter asks for everything. */
const vocabulary = ref<StoryVocabularySelection>(emptySelection())

const narrowed = computed<boolean>(() => isNarrowed(vocabulary.value))

/**
 * Whether anything is narrowing the list, and how to stop it. Both are the view's because only
 * the view knows every filter — the reset lived inside the vocabularies and cleared just those,
 * leaving the strips beside it still set.
 */
const filtersActive = computed<boolean>(
  () =>
    // Only what this view actually shows and sends. Both routes render this component, so the
    // refs survive the navigation between them: a reading filter set on the discovery board was
    // still counted on „Meine Ideen", where the strip is hidden and the query forces `any` — the
    // reset button appeared with nothing marked anywhere and clearing it changed nothing.
    (!props.mine && (readerState.value !== 'unread' || status.value !== 'open')) ||
    favourite.value !== 'any' ||
    narrowed.value,
)

function resetFilters() {
  readerState.value = 'unread'
  status.value = 'open'
  favourite.value = 'any'
  vocabulary.value = emptySelection()
}

const chosen = <T>(values: T[]): T[] | undefined => (values.length === 0 ? undefined : values)

// A search or a filter narrows the board, so whatever page was open is about a different set.
watch([settled, readerState, status, favourite, vocabulary], () => goToPage(1), {
  deep: true,
})

const { data, isPending, isError } = useListStoryIdeas(
  () => ({
    limit: IDEAS_PER_PAGE,
    offset: offset.value,
    author: props.mine ? ('mine' as const) : ('others' as const),
    readerState: props.mine ? ('any' as const) : readerState.value,
    favourite: favourite.value,
    status: props.mine ? undefined : status.value,
    search: settled.value === '' ? undefined : settled.value,
    genres: chosen(vocabulary.value.genres),
    subgenres: chosen(vocabulary.value.subgenres),
    tropes: chosen(vocabulary.value.tropes),
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

/**
 * The filters and the search outlast a failed request. They were gated on `hasLoaded` alone, so a
 * refused list took them off the page with it — and since a filter is what refuses a list, that
 * left nothing to click to undo it and no way back but a reload.
 */
const showsControls = computed<boolean>(() => hasLoaded.value || isError.value)

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
        <!-- The heading names the resource; the strip below names the view. -->
        <h1 class="text-h1 text-ink-1">Storyideen</h1>

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

      <div class="mb-2">
        <StoryIdeasViewStrip />
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
      <FilterStrips v-if="showsControls" class="mb-7">
        <!-- Neither reading nor status says anything on one's own ideas, so those two are the
             discovery board's; the favourite belongs to both. -->
        <template v-if="!mine">
          <FilterStrip
            v-model="readerState"
            label="Gelesen oder nicht"
            :options="READER_STATE_FILTERS"
            default-value="unread"
          />
          <FilterStrip
            v-model="status"
            label="Offen oder geschlossen"
            :options="STATUS_FILTERS"
            default-value="open"
          />
        </template>
        <FilterStrip
          v-model="favourite"
          label="Favoriten"
          :options="FAVOURITE_FILTERS"
          default-value="any"
        />
        <StoryVocabularyFilters v-model="vocabulary" />
        <FilterReset :active="filtersActive" @reset="resetFilters" />
      </FilterStrips>

      <Field v-if="showsControls" class="mb-7 max-w-[380px]">
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
        <!-- Both can empty a board, so an empty one names whichever are set. -->
        <template v-if="settled !== '' && narrowed">
          Keine Idee passt zu „{{ settled }}“ und diesen Filtern.
        </template>
        <template v-else-if="settled !== ''">Keine Idee passt zu „{{ settled }}“.</template>
        <template v-else-if="props.mine"> Du hast noch keine Storyidee vorgestellt. </template>
        <!-- Without these the filters' own emptiness would read as an empty board. The
             default view avoids claiming why it is empty: nothing unread and nothing at all
             look the same from here, and only one of them would be true. -->
        <!-- Before the read filter's own message, which would otherwise blame the wrong thing:
             a board emptied by a genre does not send anybody to „Gelesen“. -->
        <template v-else-if="narrowed"> Keine Idee passt zu diesen Filtern. </template>
        <template v-else-if="readerState === 'unread' && status === 'open'">
          Hier ist gerade nichts Ungelesenes. Unter „Gelesen“ findest du, was du schon kennst.
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
        <ListPagination v-model:page="page" :total="total" :items-per-page="itemsPerPage" />
      </div>

      <p v-else-if="isPending" class="text-[12.5px] text-ink-5">Ideen werden geladen …</p>

      <p v-else-if="isError" class="text-[12.5px] text-ink-5">
        Die Ideen lassen sich gerade nicht laden. Versuche es später noch einmal.
      </p>
    </div>
  </AppLayout>

  <StoryIdeaDialog v-model:open="creating" @created="openIdea" />
</template>
