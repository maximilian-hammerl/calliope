<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useListUsers } from '@/api/users/users'
import type { ListUsers200ResultsItem } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import { countLabel } from '@/lib/format/formatTime'
import { keepPreviousData } from '@tanstack/vue-query'
import { usePagedList } from '@/composables/usePagedList'
import ListPagination from '@/components/common/ListPagination.vue'
import AppLayout from '@/components/layout/AppLayout.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const LIMIT = TEXT_LIMIT.listUsers.search

/** A name per row, so a screenful is about twenty rather than the ten a paragraph row gets. */
const PAGE_SIZE = 20

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

const { page, offset, pageCount, goToPage } = usePagedList(PAGE_SIZE, () => totalResults.value)

// A search narrows the directory, so whatever page was open is about different people.
watch(settled, () => goToPage(1))

/**
 * Alphabetical, because the rows show a name and nothing else: any other order would be
 * invisible on screen, and this page is for finding somebody. Seeing who is new was the other
 * candidate and belongs in a section of its own rather than as an unexplained ordering.
 */
const { data, isPending, isError } = useListUsers(
  () => ({
    limit: PAGE_SIZE,
    offset: offset.value,
    search: settled.value === '' ? undefined : settled.value,
    sortAttribute: 'username' as const,
    sortOrder: 'asc' as const,
  }),
  { query: { placeholderData: keepPreviousData } },
)

const members = computed<ListUsers200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)

const totalResults = computed<number | undefined>(() =>
  data.value?.status === 200 ? data.value.data.totalResults : undefined,
)

const hasLoaded = computed<boolean>(() => data.value?.status === 200)
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-[18px] py-5 pb-8 md:px-10">
      <div class="max-w-[760px]">
        <h1 class="mb-2 text-[25px] leading-[1.2] text-ink-1">Mitglieder</h1>
        <p class="mb-6 max-w-[60ch] text-[13.5px] leading-[1.7] text-ink-4">
          Wer hier schreibt. Öffne ein Profil, um zu sehen, ob jemand zu dir passen könnte.
        </p>

        <Field class="mb-7 max-w-[380px]">
          <FieldLabel for="members-search">Suche</FieldLabel>
          <Input
            id="members-search"
            v-model="term"
            class="h-11 md:h-9"
            name="search"
            type="search"
            placeholder="z. B. mira"
            :maxlength="LIMIT.maxLength"
            autocomplete="off"
            spellcheck="false"
          />
          <FieldDescription> Sucht in Namen, ab {{ LIMIT.minLength }} Zeichen. </FieldDescription>
        </Field>

        <p
          v-if="hasLoaded && members.length === 0"
          class="max-w-[46ch] text-[13.5px] leading-[1.7] text-ink-4"
        >
          <template v-if="settled === ''">Hier ist noch niemand.</template>
          <template v-else>Kein Mitglied gefunden, das zu „{{ settled }}“ passt.</template>
        </p>

        <template v-else-if="hasLoaded">
          <p class="mb-1 text-[11.5px] text-ink-5">
            {{ countLabel(totalResults ?? 0, 'Mitglied', 'Mitglieder') }}
          </p>

          <ul>
            <li
              v-for="member in members"
              :key="member.id"
              class="border-b border-line-3 first:border-t"
            >
              <RouterLink
                :to="{ name: 'member', params: { userId: member.id } }"
                class="flex min-h-[44px] items-center gap-3 py-2 hover:bg-paper-2"
              >
                <UserAvatar :username="member.username" />
                <span class="min-w-0 truncate text-[13.5px] text-ink-2">
                  {{ member.username }}
                </span>
              </RouterLink>
            </li>
          </ul>

          <!-- Replaces the "N weitere Mitglieder — such nach einem Namen" line: the rest is
               reachable now, so pointing at the search field instead of offering it would be
               an apology for a list that no longer stops. -->
          <div v-if="pageCount > 1" class="mt-5 border-t border-line-2 pt-3">
            <ListPagination :page="page" :page-count="pageCount" @go="goToPage" />
          </div>
        </template>

        <p v-else-if="isPending" class="text-[12.5px] text-ink-5">Mitglieder werden geladen …</p>

        <p v-else-if="isError" class="text-[12.5px] text-ink-5">
          Die Mitglieder lassen sich gerade nicht laden. Versuche es später noch einmal.
        </p>
      </div>
    </div>
  </AppLayout>
</template>
