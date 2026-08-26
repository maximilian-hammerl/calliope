<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useListGroups } from '@/api/groups/groups'
import { FAVOURITE_FILTER_LABELS } from '@/lib/format/favourite'
import FilterStrip from '@/components/common/FilterStrip.vue'
import GroupsViewStrip from '@/components/group/GroupsViewStrip.vue'
import type { ListGroups200ResultsItem } from '@/api/models'
import { keepPreviousData } from '@tanstack/vue-query'
import { usePagedList } from '@/composables/usePagedList'
import ListPagination from '@/components/common/ListPagination.vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import GroupDialog from '@/components/group/GroupDialog.vue'
import GroupInvitationRow from '@/components/group/GroupInvitationRow.vue'
import GroupRow from '@/components/group/GroupRow.vue'
import { watchDebounced } from '@vueuse/core'
import { TEXT_LIMIT } from '@/api/textLimit'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { pluralize } from '@/lib/format/formatText'

const LIMIT = TEXT_LIMIT.listGroups.search

/** Ten to a page: enough to scan at once, few enough that a page number means something. */
const GROUPS_PER_PAGE = 10

const term = ref<string>('')

/** What the request asks for, which only follows the field once typing pauses. */
const settled = ref<string>('')
const trimmed = computed<string>(() => term.value.trim())

watchDebounced(
  trimmed,
  (value) => {
    settled.value = value.length >= LIMIT.minLength ? value : ''
  },
  { debounce: 300 },
)

// The default is the groups this member has joined; being allowed to read a public group is
// not the same as belonging to it, and this page is called Meine Gruppen.
const { page, offset, total, itemsPerPage, pageCount, goToPage } = usePagedList(
  GROUPS_PER_PAGE,
  () => totalResults.value,
)
// A search narrows the list, so whatever page was open is about a different set of groups.
/** Offered on every list that shows a favouritable kind, so none of them can drift apart. */
const favourite = ref<'any' | 'only'>('any')

const FAVOURITE_FILTERS = [
  { value: 'any', label: FAVOURITE_FILTER_LABELS.any },
  { value: 'only', label: FAVOURITE_FILTER_LABELS.only },
] as const

watch([settled, favourite], () => goToPage(1))

const { data, isPending, isError } = useListGroups(
  () => ({
    limit: GROUPS_PER_PAGE,
    offset: offset.value,
    search: settled.value === '' ? undefined : settled.value,
    // Most recently written in first: people come back to continue a story, not to look one up
    // alphabetically — and the row already dates itself by this column.
    sortAttribute: 'lastActivityAt' as const,
    favourite: favourite.value,
    sortOrder: 'desc' as const,
  }),
  // Keeps the page strip and the count on screen while the next page loads.
  { query: { placeholderData: keepPreviousData } },
)

const totalResults = computed<number | undefined>(() =>
  data.value?.status === 200 ? data.value.data.totalResults : undefined,
)

const groups = computed<ListGroups200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)

/**
 * Whether a load has ever succeeded. A query keeps its last data when a later fetch fails, so
 * this is what lets an outage leave the list standing instead of replacing it with an error —
 * and what keeps the empty state, which is a statement about the data, from being shown when
 * there is no data to make it about.
 */
const hasLoaded = computed<boolean>(() => data.value?.status === 200)

/**
 * Invitations are a separate ask, so they are a separate query rather than a filter over one
 * list — and the search below filters only the groups, never an invitation waiting on an answer.
 */
const { data: invitationsData } = useListGroups({
  limit: 100,
  membership: 'invited',
  // The membership's own column, not the group's: what orders an unanswered ask is when it
  // was made. Newest first, because that is the one still fresh in mind.
  sortAttribute: 'invitedAt',
  sortOrder: 'desc',
})

const invitations = computed<ListGroups200ResultsItem[]>(() =>
  invitationsData.value?.status === 200 ? invitationsData.value.data.results : [],
)

const router = useRouter()

function openGroup(groupId: string) {
  void router.push({ name: 'group', params: { groupId } })
}

const creating = ref<boolean>(false)
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-gutter py-5 pb-8 md:px-10">
      <!-- Above the heading, because an invitation is waiting on an answer and the groups
           below are not waiting on anything. Absent entirely when there are none. -->
      <section v-if="invitations.length > 0" class="mb-9">
        <div class="flex flex-wrap items-baseline gap-3 border-b border-line-3 pb-2.5">
          <h2 class="text-[15px] leading-[1.3] font-semibold text-ink-2">Einladungen</h2>
          <span class="text-[11.5px] text-ink-5">
            {{ pluralize(invitations.length, 'Einladung', 'Einladungen') }}
          </span>
        </div>

        <div
          v-for="(invitation, index) in invitations"
          :key="invitation.id"
          :class="index > 0 ? 'border-t border-line-2' : ''"
        >
          <GroupInvitationRow :group="invitation" />
        </div>
      </section>

      <!-- The heading names the resource and the strip below names the view, the way a group's
           title sits above its thread tabs. Both saying "Meine Gruppen" would be one thing twice.
           Discovery used to be a text link below the list, where testers missed it and a member
           with many groups never reached it — hence the strip, and hence its position. -->
      <div class="mb-2 flex flex-wrap items-baseline gap-3">
        <h1 class="text-h1 text-ink-1">Gruppen</h1>

        <div class="ml-auto">
          <Button variant="outline" size="sm" aria-label="Gruppe gründen" @click="creating = true">
            <Plus :stroke-width="1.5" />
            Gruppe
          </Button>
        </div>
      </div>

      <div class="mb-2">
        <GroupsViewStrip />
      </div>

      <p class="mb-6 max-w-[60ch] text-body text-ink-4">
        Die Gruppen, zu denen du gehörst. Öffne eine, um weiterzulesen.
      </p>

      <!-- Favourites float to the top of this list whatever it is sorted by; this narrows it to
           them. -->
      <FilterStrip
        v-model="favourite"
        label="Favoriten"
        :options="FAVOURITE_FILTERS"
        class="mb-6"
      />

      <Field v-if="hasLoaded" class="mb-7 max-w-[380px]">
        <FieldLabel for="groups-search">Suche</FieldLabel>
        <Input
          id="groups-search"
          v-model="term"
          name="search"
          type="search"
          placeholder="z. B. Erinnerungsmarkt"
          :maxlength="LIMIT.maxLength"
          autocomplete="off"
          spellcheck="false"
        />
        <FieldDescription>
          Sucht in Namen und Beschreibungen, ab {{ LIMIT.minLength }} Zeichen.
        </FieldDescription>
      </Field>

      <div v-if="hasLoaded && groups.length === 0" class="max-w-[46ch]">
        <p class="text-body text-ink-4">
          <template v-if="settled !== ''">
            Keine deiner Gruppen passt zu „{{ settled }}“.
          </template>
          <template v-else>
            Du gehörst noch zu keiner Gruppe. Gründe eine, um mit anderen zu schreiben, sieh dich
            bei den öffentlichen Gruppen um, oder warte auf eine Einladung.
          </template>
        </p>
      </div>

      <div v-else-if="hasLoaded">
        <!-- No action button: the title is the link, and nothing else in the product says
             "x öffnen". -->
        <GroupRow
          v-for="(group, index) in groups"
          :key="group.id"
          :group="group"
          :class="index > 0 ? 'border-t border-line-2' : 'pt-0'"
        />
      </div>

      <div v-if="hasLoaded && pageCount > 1" class="mt-7 border-t border-line-2 pt-3">
        <ListPagination v-model:page="page" :total="total" :items-per-page="itemsPerPage" />
      </div>

      <p v-else-if="isPending" class="text-[12.5px] text-ink-5">Gruppen werden geladen …</p>

      <p v-else-if="isError" class="text-[12.5px] text-ink-5">
        Die Gruppen lassen sich gerade nicht laden. Versuche es später noch einmal.
      </p>

      <!-- The way out of this page: without it, listing only your own groups would leave
           no way to find a public one. -->
    </div>
  </AppLayout>

  <GroupDialog v-model:open="creating" @saved="openGroup" />
</template>
