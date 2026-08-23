<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import {
  getListChatsQueryKey,
  useCreateMessage,
  useListChatMemberships,
  useReadChat,
} from '@/api/chats/chats'
import { useChatMessages } from '@/composables/useChatMessages'
import { useGetCurrentUser } from '@/api/auth/auth'
import ReportDialog from '@/components/report/ReportDialog.vue'
import type { ListMessages200ResultsItem } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatActivityTime } from '@/lib/format/formatTime'
import { listOnlyFilter } from '@/lib/api/queryKeys'
import ChatInvite from '@/components/chat/ChatInvite.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

const props = defineProps<{
  chatGroupId: string
  title: string
  live: ListMessages200ResultsItem[]
}>()

const { data: currentUserData } = useGetCurrentUser()
const currentUserId = computed<string | undefined>(() =>
  currentUserData.value?.status === 200 ? currentUserData.value.data.id : undefined,
)

/** The message being reported, which is also what opens the dialog. */
const reportingChat = ref<boolean>(false)
const reportedMessage = ref<ListMessages200ResultsItem | undefined>(undefined)
const reportingMessage = computed<boolean>({
  get: () => reportedMessage.value !== undefined,
  set: (open) => {
    if (!open) {
      reportedMessage.value = undefined
    }
  },
})

/** Only your own message is excluded; one from a deleted account is still reportable. */
function mayReport(message: ListMessages200ResultsItem): boolean {
  return currentUserId.value !== undefined && message.createdBy !== currentUserId.value
}

const queryClient = useQueryClient()

const { fetched, hasLoaded, isPending, isError, hasOlder, isLoadingOlder, loadOlder, refetch } =
  useChatMessages(() => props.chatGroupId)

/**
 * Messages the reader sent themselves. The send response carries the message and the stream
 * deliberately leaves the sender out, so this is where their own line comes from — and it is
 * why sending does not refetch: with pages loaded, a refetch would refire every one of them.
 */
const justSent = ref<ListMessages200ResultsItem[]>([])

/**
 * Oldest at the bottom, from three sources: the pages fetched, what the stream delivered, and
 * what this reader sent. Ids are uuidv7 and therefore time-ordered, so one sort puts them in
 * reading order without trusting the order they arrived in; the map is what de-duplicates a
 * message that reached the list twice.
 */
const messages = computed<ListMessages200ResultsItem[]>(() => {
  const byId = new Map<string, ListMessages200ResultsItem>()
  for (const message of [...fetched.value, ...props.live, ...justSent.value]) {
    byId.set(message.id, message)
  }
  return [...byId.values()].sort((one, other) => one.id.localeCompare(other.id))
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
 * Prepending older messages would otherwise leave `scrollTop` where it was, which is a
 * different place in a taller list: the conversation appears to jump. Growing the offset by
 * exactly how much taller it became keeps the line somebody was reading under their eyes.
 */
async function loadOlderKeepingPlace() {
  const element = scroller.value
  const heightBefore = element?.scrollHeight ?? 0
  const offsetBefore = element?.scrollTop ?? 0

  await loadOlder()
  await nextTick()

  if (element !== null) {
    element.scrollTop = offsetBefore + (element.scrollHeight - heightBefore)
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
    // The list only: its prefix also matches this conversation's own pages.
    await queryClient.invalidateQueries(listOnlyFilter(getListChatsQueryKey()))
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
    // Another conversation's sends are not this one's; the query key changes with the id.
    justSent.value = []
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
    const sent = await sendMessage({ chatId: props.chatGroupId, data: { text: written } })
    if (sent.status === 201) {
      justSent.value = [...justSent.value, sent.data]
    }
  } catch {
    sendError.value = 'Die Nachricht wurde nicht gesendet. Versuche es noch einmal.'
    return
  }

  // Cleared only once it is really sent, so nothing anybody wrote is lost.
  text.value = ''
  await scrollToLatest()
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      class="mb-3 flex flex-none flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line-3 pb-3"
    >
      <span class="text-[12.5px] text-ink-4">{{ participants }}</span>
      <div class="ml-auto flex items-center gap-4">
        <ChatInvite :chat-group-id="chatGroupId" :member-ids="memberIds" />
        <button
          type="button"
          class="flex min-h-11 items-center text-[12.5px] text-ink-5 hover:text-oak-deep md:min-h-0"
          @click="reportingChat = true"
        >
          Melden
        </button>
      </div>
    </div>

    <div ref="scroller" class="min-h-0 flex-1 overflow-y-auto pr-1">
      <!-- A button rather than a scroll trigger: this list also moves when a message arrives
           and when one is sent, and a load fired by scrolling into those movements is how the
           earlier watcher loop happened. -->
      <div v-if="hasOlder" class="mb-[14px] flex justify-center">
        <Button variant="ghost" size="sm" :disabled="isLoadingOlder" @click="loadOlderKeepingPlace">
          <Spinner v-if="isLoadingOlder" data-icon="inline-start" />
          Ältere Nachrichten
        </Button>
      </div>

      <p v-if="hasLoaded && messages.length === 0" class="max-w-[46ch] text-body text-ink-4">
        Noch nichts geschrieben. Fang an.
      </p>

      <!-- The pane is as wide as the dialog now; the messages are not. At 960px the lines ran
           to about ninety-five characters, half again the comfortable measure. In px rather
           than `ch`: this list inherits 16px while the messages are 13.5px, so a ch cap here
           measures the wrong text and comes out a third too wide. -->
      <ul v-else-if="messages.length > 0" class="flex max-w-[520px] flex-col gap-[14px]">
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
          <p class="text-note whitespace-pre-wrap text-ink-2">
            {{ message.text }}
          </p>

          <!-- The same row a post carries, at the same weight and in the same place. -->
          <div v-if="mayReport(message)" class="mt-[6px] flex items-center text-[12px] text-ink-5">
            <button
              type="button"
              class="flex min-h-11 items-center hover:text-oak-deep md:min-h-0"
              @click="reportedMessage = message"
            >
              Melden
            </button>
          </div>
        </li>
      </ul>

      <p v-else-if="isPending" class="text-[12.5px] text-ink-5">Wird geladen …</p>

      <p v-else-if="isError" class="text-[12.5px] text-ink-5">
        Die Nachrichten lassen sich gerade nicht laden.
      </p>
    </div>

    <Alert v-if="sendError" variant="destructive" role="alert" class="mt-3">
      <AlertDescription>{{ sendError }}</AlertDescription>
    </Alert>

    <form class="mt-3 flex flex-none gap-2 border-t border-line-3 pt-3" @submit.prevent="submit">
      <Input
        v-model="text"
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

  <ReportDialog
    v-model:open="reportingChat"
    target-type="chat_group"
    :target-id="props.chatGroupId"
    :subject="props.title"
  />

  <ReportDialog
    v-if="reportedMessage"
    v-model:open="reportingMessage"
    target-type="chat_message"
    :target-id="reportedMessage.id"
    :subject="reportedMessage.createdByUsername ?? 'Gelöschtes Konto'"
  />
</template>
