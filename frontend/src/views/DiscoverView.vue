<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronLeft } from '@lucide/vue'
import { watchDebounced } from '@vueuse/core'
import { useListGroups } from '@/api/groups/groups'
import type { ListGroups200ResultsItem } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import AppLayout from '@/components/layout/AppLayout.vue'
import CreateGroupDialog from '@/components/group/CreateGroupDialog.vue'
import GroupRow from '@/components/group/GroupRow.vue'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const LIMIT = TEXT_LIMIT.listGroups.search

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
const { data, isPending, isError } = useListGroups(() => ({
  limit: 100,
  membership: 'none' as const,
  search: settled.value === '' ? undefined : settled.value,
  sortAttribute: 'lastActivityAt' as const,
  sortOrder: 'desc' as const,
}))

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

const creating = ref<boolean>(false)
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-[18px] py-5 pb-8 md:px-10">
      <div class="max-w-[760px]">
        <RouterLink
          :to="{ name: 'groups' }"
          class="inline-flex min-h-11 items-center gap-[3px] text-[12.5px] text-ink-5 hover:text-oak-deep md:min-h-0"
        >
          <ChevronLeft :size="14" :stroke-width="1.5" />
          Meine Gruppen
        </RouterLink>

        <h1 class="mt-3 mb-2 text-[25px] leading-[1.2] text-ink-1">Gruppen entdecken</h1>
        <p class="mb-6 max-w-[60ch] text-[13.5px] leading-[1.7] text-ink-4">
          Öffentliche Gruppen, in denen du noch nicht bist. Mitlesen kannst du sofort; mitschreiben,
          sobald dich jemand einlädt.
        </p>

        <Field class="mb-7 max-w-[380px]">
          <FieldLabel for="discover-search">Suche</FieldLabel>
          <Input
            id="discover-search"
            v-model="term"
            class="h-11 md:h-9"
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

        <p
          v-if="hasLoaded && groups.length === 0"
          class="max-w-[46ch] text-[13.5px] leading-[1.7] text-ink-4"
        >
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
          >
            <template #actions>
              <!-- Reading is all a non-member can do: there is no joining a public group
                   uninvited, and saying so is better than a button that would fail. -->
              <Button
                variant="outline"
                size="sm"
                @click="$router.push({ name: 'group', params: { groupId: group.id } })"
              >
                Gruppe ansehen
              </Button>
            </template>
          </GroupRow>
        </div>

        <p v-else-if="isPending" class="text-[12.5px] text-ink-5">Gruppen werden geladen …</p>

        <p v-else-if="isError" class="text-[12.5px] text-ink-5">
          Die Gruppen lassen sich gerade nicht laden. Versuche es später noch einmal.
        </p>
      </div>
    </div>
  </AppLayout>

  <CreateGroupDialog v-model:open="creating" />
</template>
