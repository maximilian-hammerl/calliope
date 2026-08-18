<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { getListMembershipsQueryKey, useInviteMember } from '@/api/memberships/memberships'
import { useListUsers } from '@/api/users/users'
import { TEXT_LIMIT } from '@/api/textLimit'
import type { InviteMemberBodyRole, ListUsers200ResultsItem } from '@/api/models'
import { ApiError } from '@/lib/apiFetch'
import { listKeyPrefix } from '@/lib/queryKeys'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const props = defineProps<{ groupId: string; memberIds: string[] }>()
const open = defineModel<boolean>('open', { required: true })

const queryClient = useQueryClient()

const term = ref<string>('')
const selected = ref<ListUsers200ResultsItem | undefined>(undefined)
const role = ref<InviteMemberBodyRole>('writer')
const formError = ref<string | undefined>(undefined)

/** The API's own bounds. Below the minimum nothing is asked for at all. */
const LIMIT = TEXT_LIMIT.listUsers.search

const trimmedTerm = computed<string>(() => term.value.trim())
const termIsLongEnough = computed<boolean>(() => trimmedTerm.value.length >= LIMIT.minLength)

const { data: usersData, isFetching } = useListUsers(
  () => ({ search: trimmedTerm.value, limit: 8 }),
  {
    query: {
      // Both guards matter: without a term the endpoint would return everyone, and a closed
      // dialog has no reason to be asking.
      enabled: () => open.value && termIsLongEnough.value,
      // A name does not change between keystrokes, so a repeated term is served from cache.
      staleTime: 30_000,
    },
  },
)

/**
 * People already in the group are dropped rather than shown as unavailable: an invitation
 * they cannot accept twice is not a useful thing to look at, and the list is short.
 */
const candidates = computed<ListUsers200ResultsItem[]>(() => {
  if (usersData.value?.status !== 200) {
    return []
  }
  return usersData.value.data.results.filter((user) => !props.memberIds.includes(user.id))
})

watch(open, (isOpen) => {
  if (isOpen) {
    return
  }
  term.value = ''
  selected.value = undefined
  role.value = 'writer'
  formError.value = undefined
})

// Typing again is a new search, so an earlier pick must not silently stay selected.
watch(trimmedTerm, () => {
  selected.value = undefined
  formError.value = undefined
})

const { mutateAsync: inviteMember, isPending } = useInviteMember()

async function submit() {
  const user = selected.value
  if (user === undefined) {
    return
  }

  formError.value = undefined

  try {
    await inviteMember({ groupId: props.groupId, data: { userId: user.id, role: role.value } })
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      formError.value = `${user.username} gehört schon zur Gruppe oder ist bereits eingeladen.`
      return
    }
    formError.value = 'Die Einladung konnte nicht verschickt werden. Versuche es noch einmal.'
    return
  }

  await queryClient.invalidateQueries({
    queryKey: listKeyPrefix(getListMembershipsQueryKey(props.groupId)),
  })
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[440px]">
      <DialogHeader>
        <DialogTitle>Mitglied einladen</DialogTitle>
        <DialogDescription>
          Such nach dem Benutzernamen. Eingeladene entscheiden selbst, ob sie beitreten.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
        <Alert v-if="formError" variant="destructive" role="alert">
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <FieldGroup>
          <Field>
            <FieldLabel for="invite-search">Benutzername</FieldLabel>
            <Input
              id="invite-search"
              v-model="term"
              class="h-11 md:h-9"
              name="search"
              :maxlength="LIMIT.maxLength"
              placeholder="z. B. mira"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
            />
          </Field>
        </FieldGroup>

        <!-- Results are a list of buttons rather than a select: the set changes with every
             keystroke, and a native menu would close over the field being typed into. -->
        <div class="min-h-[44px]">
          <p v-if="!termIsLongEnough" class="text-[12.5px] leading-[1.5] text-ink-5">
            Gib mindestens {{ LIMIT.minLength }} Zeichen ein. Ein Teil des Namens genügt.
          </p>
          <p v-else-if="isFetching" class="text-[12.5px] leading-[1.5] text-ink-5">
            Wird gesucht …
          </p>
          <p v-else-if="candidates.length === 0" class="text-[12.5px] leading-[1.5] text-ink-5">
            Niemand gefunden, der oder die nicht schon dabei ist.
          </p>
          <ul v-else class="flex flex-col border-t border-line-3">
            <li v-for="user in candidates" :key="user.id">
              <button
                type="button"
                class="flex min-h-[44px] w-full items-center justify-between border-b border-line-3 px-1 text-left text-[13.5px] text-ink-2 md:min-h-[38px]"
                :class="selected?.id === user.id ? 'bg-paper-3 font-semibold' : ''"
                :aria-pressed="selected?.id === user.id"
                @click="selected = user"
              >
                {{ user.username }}
                <span v-if="selected?.id === user.id" class="text-[12px] text-ink-5">
                  ausgewählt
                </span>
              </button>
            </li>
          </ul>
        </div>

        <FieldGroup v-if="selected">
          <Field>
            <FieldLabel for="invite-role">Rolle</FieldLabel>
            <select
              id="invite-role"
              v-model="role"
              name="role"
              class="h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm md:h-9"
            >
              <option value="writer">Schreibt — verfasst Beiträge</option>
              <option value="reader">Liest — liest mit und kommentiert</option>
              <option value="administrator">Admin — verwaltet Mitglieder</option>
            </select>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isPending" @click="open = false">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="isPending || selected === undefined">
            <Spinner v-if="isPending" data-icon="inline-start" />
            Mitglied einladen
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
