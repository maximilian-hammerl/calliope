<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus } from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import {
  getListChatsQueryKey,
  useAcceptChatInvitation,
  useCreateChat,
  useListChats,
} from '@/api/chats/chats'
import type { ListChats200ResultsItem, ListMessages200ResultsItem } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatActivityTime } from '@/lib/format/formatTime'
import { listOnlyFilter } from '@/lib/api/queryKeys'
import { useChatStream } from '@/composables/useChatStream'
import ChatConversation from '@/components/chat/ChatConversation.vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

const open = defineModel<boolean>('open', { required: true })
/** Set when a chat invitation was followed from the notifications dialog. */
const props = defineProps<{ startAt?: string }>()

const queryClient = useQueryClient()

const { data, refetch } = useListChats({ limit: 50 })
const chats = computed<ListChats200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)

const selectedId = ref<string | undefined>(undefined)
const selected = computed<ListChats200ResultsItem | undefined>(() =>
  chats.value.find((chat) => chat.id === selectedId.value),
)

/** Messages the stream delivered since the conversation last fetched, keyed by chat. */
const liveByChat = ref<Record<string, ListMessages200ResultsItem[]>>({})

const { connected } = useChatStream((event) => {
  const existing = liveByChat.value[event.chatGroupId] ?? []
  liveByChat.value = {
    ...liveByChat.value,
    [event.chatGroupId]: [...existing, event.message as ListMessages200ResultsItem],
  }
  // The list carries unread counts and the ordering, both of which just changed.
  void queryClient.invalidateQueries(listOnlyFilter(getListChatsQueryKey()))
})

// The stream cannot say what arrived while it was away, so coming back is a refetch rather
// than a replay — which is also what makes the server's fan-out replaceable.
watch(connected, (isConnected) => {
  if (isConnected) {
    void refetch()
  }
})

watch(
  () => props.startAt,
  (chatGroupId) => {
    if (chatGroupId !== undefined) {
      selectedId.value = chatGroupId
    }
  },
  { immediate: true },
)

const creating = ref<boolean>(false)
const newTitle = ref<string>('')
const { mutateAsync: createChat, isPending: isCreating } = useCreateChat()
const { mutateAsync: acceptInvitation } = useAcceptChatInvitation()

async function create() {
  const title = newTitle.value.trim()
  if (title.length === 0) {
    return
  }

  const created = await createChat({ data: { title } }).catch(() => undefined)
  newTitle.value = ''
  creating.value = false
  await queryClient.invalidateQueries(listOnlyFilter(getListChatsQueryKey()))

  if (created?.status === 201) {
    selectedId.value = created.data.id
  }
}

async function accept(chatGroupId: string) {
  await acceptInvitation({ chatId: chatGroupId }).catch(() => undefined)
  await queryClient.invalidateQueries(listOnlyFilter(getListChatsQueryKey()))
}

/** An invitation is visible but not yet a conversation, so it cannot be opened. */
const selectedIsInvitation = computed<boolean>(() => selected.value?.status === 'invited')
</script>

<template>
  <Dialog v-model:open="open">
    <DialogScrollContent class="sm:max-w-dialog-workspace">
      <DialogHeader>
        <DialogTitle>Nachrichten</DialogTitle>
        <DialogDescription>
          Unterhaltungen mit anderen Mitgliedern, unabhängig von einer Gruppe.
        </DialogDescription>
      </DialogHeader>

      <!-- A fixed height, not a minimum: the message list scrolls inside this row, and with a
           minimum the row grew with the conversation instead — the dialog ran off the bottom of
           the screen and took the composer with it, which only showed once a page held 50
           messages. Capped by viewport too, so a short screen still gets a usable pane. -->
      <div class="flex h-[min(70svh,560px)] gap-4">
        <!-- One pane at a time below md, both side by side above it. -->
        <div
          class="flex w-full flex-none flex-col gap-1 md:w-[220px] md:border-r md:border-line-3 md:pr-3"
          :class="selectedId !== undefined ? 'hidden md:flex' : 'flex'"
        >
          <button
            type="button"
            class="flex min-h-11 items-center gap-[4px] py-[7px] text-[13px] text-ink-5 hover:text-oak-deep md:min-h-0"
            @click="creating = !creating"
          >
            <Plus :size="14" :stroke-width="1.5" />
            Unterhaltung
          </button>

          <form v-if="creating" class="mb-2 flex gap-2" @submit.prevent="create">
            <Input
              v-model="newTitle"
              class="h-9"
              name="title"
              placeholder="z. B. Planung"
              :maxlength="TEXT_LIMIT.createChat.title.maxLength"
            />
            <Button type="submit" size="sm" :disabled="isCreating">Anlegen</Button>
          </form>

          <p v-if="chats.length === 0" class="py-[7px] text-[12.5px] text-ink-5">
            Noch keine Unterhaltungen.
          </p>

          <button
            v-for="chat in chats"
            :key="chat.id"
            type="button"
            class="flex min-h-[44px] flex-col items-start border-l-2 py-[7px] pl-[11px] text-left md:min-h-[38px]"
            :class="
              chat.id === selectedId
                ? 'border-oak font-medium text-ink-1'
                : 'border-line-4 text-ink-4 hover:border-line-5 hover:text-ink-1'
            "
            @click="selectedId = chat.id"
          >
            <span class="flex w-full items-baseline gap-2 text-[13px]">
              {{ chat.title }}
              <span v-if="chat.unreadMessages > 0" class="ml-auto text-[11.5px] text-oak-deep">
                {{ chat.unreadMessages }} neu
              </span>
            </span>
            <span class="text-[11px] text-ink-6">
              {{ formatActivityTime(chat.lastActivityAt) }}
            </span>
          </button>
        </div>

        <div
          class="flex min-h-0 w-full flex-col"
          :class="selectedId === undefined ? 'hidden md:flex' : 'flex'"
        >
          <button
            v-if="selectedId !== undefined"
            type="button"
            class="mb-2 flex min-h-11 items-center self-start text-[12.5px] text-ink-5 md:hidden"
            @click="selectedId = undefined"
          >
            ← Alle Unterhaltungen
          </button>

          <p v-if="selectedId === undefined" class="text-[13.5px] leading-[1.7] text-ink-4">
            Wähle links eine Unterhaltung.
          </p>

          <template v-else-if="selected">
            <div v-if="selectedIsInvitation" class="text-[13.5px] leading-[1.7] text-ink-4">
              <p>Du bist zu „{{ selected.title }}“ eingeladen.</p>
              <Button size="sm" class="mt-4" @click="accept(selected.id)">Beitreten</Button>
            </div>
            <ChatConversation
              v-else
              :chat-group-id="selected.id"
              :live="liveByChat[selected.id] ?? []"
            />
          </template>
        </div>
      </div>
    </DialogScrollContent>
  </Dialog>
</template>
