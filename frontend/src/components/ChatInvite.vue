<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus } from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import { getListChatMembershipsQueryKey, useInviteToChat } from '@/api/chats/chats'
import { useListUsers } from '@/api/users/users'
import type { ListUsers200ResultsItem } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import { ApiError } from '@/lib/apiFetch'
import { listKeyPrefix } from '@/lib/queryKeys'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'

const props = defineProps<{ chatGroupId: string; memberIds: string[] }>()

const queryClient = useQueryClient()

const open = ref<boolean>(false)
const term = ref<string>('')
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
      // panel has no reason to be asking.
      enabled: () => open.value && termIsLongEnough.value,
      // A name does not change between keystrokes, so a repeated term is served from cache.
      staleTime: 30_000,
    },
  },
)

/**
 * People already in the chat are dropped rather than shown as unavailable: an invitation they
 * cannot accept twice is not a useful thing to look at, and the list is short.
 */
const candidates = computed<ListUsers200ResultsItem[]>(() => {
  if (usersData.value?.status !== 200) {
    return []
  }
  return usersData.value.data.results.filter((user) => !props.memberIds.includes(user.id))
})

// A different conversation is a different invitation.
watch(
  () => props.chatGroupId,
  () => {
    open.value = false
    term.value = ''
    formError.value = undefined
  },
)

const { mutateAsync: inviteToChat, isPending } = useInviteToChat()

async function invite(user: ListUsers200ResultsItem) {
  formError.value = undefined

  try {
    await inviteToChat({ chatId: props.chatGroupId, data: { userId: user.id } })
  } catch (error) {
    formError.value =
      error instanceof ApiError && error.status === 409
        ? `${user.username} ist schon eingeladen oder schon dabei.`
        : 'Die Einladung wurde nicht verschickt. Versuche es noch einmal.'
    return
  }

  term.value = ''
  open.value = false
  await queryClient.invalidateQueries({
    queryKey: listKeyPrefix(getListChatMembershipsQueryKey(props.chatGroupId)),
  })
}
</script>

<template>
  <div>
    <button
      type="button"
      class="flex items-center gap-[4px] text-[12.5px] text-ink-5 hover:text-oak-deep"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Plus :size="14" :stroke-width="1.5" />
      Einladen
    </button>

    <div v-if="open" class="mt-2">
      <Input
        v-model="term"
        class="h-9"
        name="search"
        placeholder="z. B. mira"
        autocomplete="off"
        autocapitalize="none"
        spellcheck="false"
        :maxlength="LIMIT.maxLength"
      />

      <Alert v-if="formError" variant="destructive" role="alert" class="mt-2">
        <AlertDescription>{{ formError }}</AlertDescription>
      </Alert>

      <!-- Buttons rather than a select: the set changes with every keystroke, and a native
           menu would close over the field being typed into. -->
      <p v-if="!termIsLongEnough" class="mt-2 text-[12px] text-ink-5">
        Gib mindestens {{ LIMIT.minLength }} Zeichen ein. Ein Teil des Namens genügt.
      </p>
      <p v-else-if="isFetching" class="mt-2 text-[12px] text-ink-5">Wird gesucht …</p>
      <p v-else-if="candidates.length === 0" class="mt-2 text-[12px] text-ink-5">
        Niemand gefunden, der oder die nicht schon dabei ist.
      </p>
      <ul v-else class="mt-1 flex flex-col border-t border-line-3">
        <li v-for="user in candidates" :key="user.id">
          <button
            type="button"
            class="flex min-h-[44px] w-full items-center border-b border-line-3 px-1 text-left text-[13px] text-ink-2 md:min-h-[36px]"
            :disabled="isPending"
            @click="invite(user)"
          >
            {{ user.username }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
