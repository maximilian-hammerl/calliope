<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import {
  getListChatsQueryKey,
  useCreateMessage,
  useListChatMemberships,
  useListMessages,
  useReadChat,
} from '@/api/chats/chats'
import type { ListMessages200ResultsItem } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatActivityTime } from '@/lib/formatTime'
import { listKeyPrefix } from '@/lib/queryKeys'
import ChatInvite from '@/components/ChatInvite.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const props = defineProps<{ chatGroupId: string; live: ListMessages200ResultsItem[] }>()

const queryClient = useQueryClient()

const { data, isPending, isError, refetch } = useListMessages(() => props.chatGroupId, {
  limit: 50,
})

/**
 * Oldest at the bottom. The API returns newest first — that is what a cursor pages back
 * through — so the list is reversed for reading, and anything the stream delivered since the
 * fetch is appended after it.
 */
const messages = computed<ListMessages200ResultsItem[]>(() => {
  const fetched = data.value?.status === 200 ? [...data.value.data.results].reverse() : []
  const known = new Set(fetched.map((message) => message.id))
  return [...fetched, ...props.live.filter((message) => !known.has(message.id))]
})

const { data: membersData } = useListChatMemberships(() => props.chatGroupId, { limit: 50 })

const members = computed(() =>
  membersData.value?.status === 200 ? membersData.value.data.results : [],
)

const memberIds = computed<string[]>(() => members.value.map((member) => member.userId))

/**
 * Who is in the conversation, with anybody still deciding marked. A chat is small, so this is
 * a line of names rather than a list — enough to know who can read what you write.
 */
const participants = computed<string>(() =>
  members.value
    .map((member) =>
      member.status === 'invited' ? `${member.username} (eingeladen)` : member.username,
    )
    .join(', '),
)

const text = ref<string>('')
const sendError = ref<string | undefined>(undefined)
const scroller = ref<HTMLElement | null>(null)

const { mutateAsync: sendMessage, isPending: sending } = useCreateMessage()
const { mutateAsync: markRead } = useReadChat()

async function scrollToLatest() {
  await nextTick()
  const element = scroller.value
  if (element !== null) {
    element.scrollTop = element.scrollHeight
  }
}

/**
 * The id of the newest message, which is what "something arrived" actually means here.
 *
 * Watching `messages` instead looks equivalent and is not: it is a computed array, and the
 * `live` prop is rebuilt on every render of the parent, so the array is never the same object
 * twice. Marking read invalidates the chat list, which re-renders the parent, which produces
 * a new array, which fires the watcher again — a loop that ran until the rate limiter stopped
 * it. A string cannot do that.
 */
const latestMessageId = computed<string | undefined>(() => messages.value.at(-1)?.id)

// Opening a chat, and every message after it, counts as read.
watch(
  [() => props.chatGroupId, latestMessageId],
  async () => {
    await scrollToLatest()
    await markRead({ chatId: props.chatGroupId }).catch(() => undefined)
    await queryClient.invalidateQueries({ queryKey: listKeyPrefix(getListChatsQueryKey()) })
  },
  { immediate: true },
)

// A message written while the composer was closed is not worth keeping; a chat switched away
// from is a different conversation.
watch(
  () => props.chatGroupId,
  () => {
    text.value = ''
    sendError.value = undefined
    void refetch()
  },
)

async function submit() {
  const written = text.value.trim()
  if (written.length === 0) {
    return
  }

  sendError.value = undefined
  try {
    await sendMessage({ chatId: props.chatGroupId, data: { text: written } })
  } catch {
    sendError.value = 'Die Nachricht wurde nicht gesendet. Versuche es noch einmal.'
    return
  }

  // Cleared only once it is really sent, so nothing anybody wrote is lost.
  text.value = ''
  await refetch()
  await scrollToLatest()
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      class="mb-3 flex flex-none flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-3 pb-3"
    >
      <span class="text-[12.5px] text-ink-4">{{ participants }}</span>
      <div class="ml-auto">
        <ChatInvite :chat-group-id="chatGroupId" :member-ids="memberIds" />
      </div>
    </div>

    <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto pr-1">
      <p v-if="isPending" class="text-[12.5px] text-ink-5">Wird geladen …</p>

      <p v-else-if="isError" class="text-[12.5px] text-ink-5">
        Die Nachrichten lassen sich gerade nicht laden.
      </p>

      <p
        v-else-if="messages.length === 0"
        class="max-w-[46ch] text-[13.5px] leading-[1.7] text-ink-4"
      >
        Noch nichts geschrieben. Fang an.
      </p>

      <ul v-else class="flex flex-col gap-[14px]">
        <li v-for="message in messages" :key="message.id">
          <div class="flex items-baseline gap-2">
            <span class="text-[12.5px] font-semibold text-ink-3">
              {{ message.createdByUsername ?? 'Gelöschtes Konto' }}
            </span>
            <span class="text-[11.5px] text-ink-6">
              {{ formatActivityTime(message.createdAt) }}
            </span>
          </div>
          <!-- Plain text, deliberately: a chat is remarks, not prose. -->
          <p class="text-[13.5px] leading-[1.6] whitespace-pre-wrap text-ink-2">
            {{ message.text }}
          </p>
        </li>
      </ul>
    </div>

    <Alert v-if="sendError" variant="destructive" role="alert" class="mt-3">
      <AlertDescription>{{ sendError }}</AlertDescription>
    </Alert>

    <form class="mt-3 flex flex-none gap-2 border-t border-line-3 pt-3" @submit.prevent="submit">
      <Input
        v-model="text"
        class="h-11 md:h-9"
        name="message"
        placeholder="Schreib etwas …"
        autocomplete="off"
        :maxlength="TEXT_LIMIT.createMessage.text.maxLength"
      />
      <Button type="submit" :disabled="sending || text.trim().length === 0">
        <Spinner v-if="sending" data-icon="inline-start" />
        Senden
      </Button>
    </form>
  </div>
</template>
