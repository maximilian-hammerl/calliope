<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { watchDebounced } from '@vueuse/core'
import { useListGroups } from '@/api/groups/groups'
import { FAVOURITE_FILTER_LABELS } from '@/lib/format/favourite'
import FilterStrip from '@/components/common/FilterStrip.vue'
import GroupsViewStrip from '@/components/group/GroupsViewStrip.vue'
import type { ListGroups200ResultsItem } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import { Plus } from '@lucide/vue'
import { keepPreviousData } from '@tanstack/vue-query'
import { usePagedList } from '@/composables/usePagedList'
import ListPagination from '@/components/common/ListPagination.vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import GroupDialog from '@/components/group/GroupDialog.vue'
import GroupRow from '@/components/group/GroupRow.vue'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

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
    // Below the minimum the server refuses the term, so an emptied field goes back to
    // listing everything rather than sending two characters.
    settled.value = value.length >= LIMIT.minLength ? value : ''
  },
  { debounce: 300 },
)

/**
 * Public groups this member is not in. `none` is what makes it discovery rather than a second
 * copy of Meine Gruppen — a group they already belong to is not something to find.
 */
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
    membership: 'none' as const,
    search: settled.value === '' ? undefined : settled.value,
    sortAttribute: 'lastActivityAt' as const,
    favourite: favourite.value,
    sortOrder: 'desc' as const,
  }),
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

const router = useRouter()

function openGroup(groupId: string) {
  void router.push({ name: 'group', params: { groupId } })
}

const creating = ref<boolean>(false)
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-gutter py-5 pb-8 md:px-10">
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
        Öffentliche Gruppen, in denen du noch nicht bist. Mitlesen kannst du sofort; mitschreiben,
        sobald dich jemand einlädt.
      </p>

      <!-- Favourites float to the top of this list whatever it is sorted by; this narrows it to
           them. -->
      <FilterStrip
        v-model="favourite"
        label="Favoriten"
        :options="FAVOURITE_FILTERS"
        class="mb-6"
      />

      <Field class="mb-7 max-w-[380px]">
        <FieldLabel for="discover-search">Suche</FieldLabel>
        <Input
          id="discover-search"
          v-model="term"
          name="search"
          type="search"
          placeholder="z. B. Krimi"
          :maxlength="LIMIT.maxLength"
          autocomplete="off"
          spellcheck="false"
        />
        <FieldDescription>
          Sucht in Namen und Beschreibungen, ab {{ LIMIT.minLength }} Zeichen.
        </FieldDescription>
      </Field>

      <p v-if="hasLoaded && groups.length === 0" class="max-w-[46ch] text-body text-ink-4">
        <template v-if="settled === ''">
          Im Moment gibt es keine öffentliche Gruppe, in der du nicht schon bist.
        </template>
        <template v-else>
          Keine öffentliche Gruppe gefunden, die zu „{{ settled }}“ passt.
        </template>
      </p>

      <div v-else-if="hasLoaded">
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
    </div>

    <GroupDialog v-model:open="creating" @saved="openGroup" />
  </AppLayout>
</template>
