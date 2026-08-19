<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { getGetCurrentUserQueryKey } from '@/api/auth/auth'
import { useListNotifications, useReadNotifications } from '@/api/notifications/notifications'
import type { ListNotifications200ResultsItem } from '@/api/models'
import { formatActivityTime } from '@/lib/format/formatTime'
import { notificationAction, notificationText } from '@/lib/notification/notificationText'
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogScrollContent,
  DialogTitle,
} from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{ openChat: [chatGroupId: string] }>()

const router = useRouter()

/**
 * Chats have no URL — they live in the Nachrichten dialog — so this either navigates or asks
 * the top bar, which owns both dialogs, to open the other one.
 */
function follow(notification: ListNotifications200ResultsItem) {
  const action = notificationAction(notification)
  open.value = false

  if (action.kind === 'route') {
    void router.push(action.to)
    return
  }

  emit('openChat', action.chatGroupId)
}

const queryClient = useQueryClient()

// Only asked for while the dialog is open: this sits in the top bar on every page, and a list
// nobody is looking at is not worth fetching.
const { data, isPending, isError } = useListNotifications(
  { limit: 50 },
  { query: { enabled: open } },
)

const notifications = computed<ListNotifications200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)

const { mutateAsync: markAllRead } = useReadNotifications()

/**
 * Opening the list is the act of having read it, so everything is marked at once rather than
 * asking anybody to dismiss lines one by one.
 *
 * Only the current-user query is invalidated, never this list: that clears the mark on the
 * avatar while leaving the dialog showing which ones were new when it was opened. Refetching
 * here would mark them read in front of the reader.
 */
watch(notifications, async (loaded) => {
  if (!open.value || !loaded.some((notification) => notification.readAt === null)) {
    return
  }
  await markAllRead().catch(() => undefined)
  await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() })
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogScrollContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>Mitteilungen</DialogTitle>
        <DialogDescription>Was in deinen Gruppen passiert ist.</DialogDescription>
      </DialogHeader>

      <p v-if="isPending" class="text-[12.5px] text-ink-5">Wird geladen …</p>

      <p v-else-if="isError" class="text-[12.5px] text-ink-5">
        Die Mitteilungen lassen sich gerade nicht laden. Versuche es später noch einmal.
      </p>

      <p
        v-else-if="notifications.length === 0"
        class="max-w-[46ch] text-[13.5px] leading-[1.7] text-ink-4"
      >
        Im Moment ist es still.
      </p>

      <ul v-else>
        <!-- Hairline rows, no cards. Unread is a matter of ink, not a badge. -->
        <li
          v-for="(notification, index) in notifications"
          :key="notification.id"
          class="border-b border-line-2"
          :class="index === 0 ? 'border-t' : ''"
        >
          <!-- A button rather than a link, because not every notification leads to a URL: a
               chat opens the Nachrichten dialog instead. Closing on the way out is the point
               either way — you land on the thing it is about, from wherever you were. -->
          <button
            type="button"
            class="flex min-h-[44px] w-full flex-wrap items-baseline gap-x-3 gap-y-1 py-[12px] text-left"
            @click="follow(notification)"
          >
            <span
              class="text-[13.5px] leading-[1.6]"
              :class="notification.readAt === null ? 'font-medium text-ink-1' : 'text-ink-4'"
            >
              {{ notificationText(notification) }}
            </span>
            <span class="ml-auto text-[11.5px] whitespace-nowrap text-ink-6">
              {{ formatActivityTime(notification.occurredAt) }}
            </span>
          </button>
        </li>
      </ul>
    </DialogScrollContent>
  </Dialog>
</template>
