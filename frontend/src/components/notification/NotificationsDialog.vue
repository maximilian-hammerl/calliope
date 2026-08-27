<script setup lang="ts">
import { computed, watch } from 'vue'
import { ChevronRight } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { keepPreviousData, useQueryClient } from '@tanstack/vue-query'
import { getGetCurrentUserQueryKey } from '@/api/auth/auth'
import { useListNotifications, useReadNotifications } from '@/api/notifications/notifications'
import { usePagedList } from '@/composables/usePagedList'
import ListPagination from '@/components/common/ListPagination.vue'
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
 * Chats have no URL — they live in the Chats dialog — so this either navigates or asks
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
/** A sentence per row, so a screenful is about twenty. */
const PER_PAGE = 20

// Kept in memory rather than the address: a dialog is not what a URL describes, and the page
// of the list behind it uses the same key.
const { page, offset, total, itemsPerPage, pageCount, goToPage } = usePagedList(
  PER_PAGE,
  () => totalResults.value,
  false,
)

const { data, isPending, isError } = useListNotifications(
  () => ({ limit: PER_PAGE, offset: offset.value }),
  { query: { enabled: open, placeholderData: keepPreviousData } },
)

const totalResults = computed<number | undefined>(() =>
  data.value?.status === 200 ? data.value.data.totalResults : undefined,
)

const notifications = computed<ListNotifications200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)

// Opening it again starts at the top, where what is new actually is.
watch(open, (isOpen) => {
  if (isOpen) {
    goToPage(1)
  }
})

/**
 * Whether a load has ever succeeded. A query keeps its last data when a later fetch fails, so
 * this is what lets an outage leave the list standing instead of replacing it with an error —
 * and what keeps the empty state, which is a statement about the data, from being shown when
 * there is no data to make it about.
 */
const hasLoaded = computed<boolean>(() => data.value?.status === 200)

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
    <DialogScrollContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>Mitteilungen</DialogTitle>
        <DialogDescription>Was in deinen Gruppen passiert ist.</DialogDescription>
      </DialogHeader>

      <p v-if="hasLoaded && notifications.length === 0" class="max-w-[46ch] text-body text-ink-4">
        Im Moment ist es still.
      </p>

      <!-- Pulled out to the dialog's padding so a hovered row fills to the edges and reads as
           a row rather than as a hovered paragraph. -->
      <ul v-else-if="hasLoaded" class="-mx-2">
        <!-- Hairline rows, no cards. Unread is a matter of ink — and of one oak dot, which
             weight alone was too quiet to supply when only a single row is new. -->
        <li
          v-for="(notification, index) in notifications"
          :key="notification.id"
          class="border-b border-line-2"
          :class="index === 0 ? 'border-t' : ''"
        >
          <!-- A button rather than a link, because not every notification leads to a URL: a
               chat opens the Chats dialog instead. Closing on the way out is the point
               either way — you land on the thing it is about, from wherever you were. -->
          <button
            type="button"
            class="group flex min-h-[44px] w-full items-start gap-3 px-2 py-3 text-left hover:bg-paper-1"
            @click="follow(notification)"
          >
            <!-- Always in the flow, coloured only when unread, so read and unread rows keep
                 the same left edge. -->
            <span
              class="mt-2 size-[5px] shrink-0 rounded-full"
              :class="notification.readAt === null ? 'bg-oak' : 'bg-transparent'"
              aria-hidden="true"
            />
            <span
              class="min-w-0 flex-1 text-note"
              :class="notification.readAt === null ? 'font-medium text-ink-1' : 'text-ink-4'"
            >
              {{ notificationText(notification) }}
            </span>
            <span class="mt-[3px] text-[11.5px] whitespace-nowrap text-ink-6">
              {{ formatActivityTime(notification.occurredAt) }}
            </span>
            <!-- Present at rest rather than on hover: this is what says the row leads
                 somewhere, and touch never hovers. -->
            <ChevronRight
              class="mt-1 shrink-0 text-ink-6 group-hover:text-ink-3"
              :size="14"
              :stroke-width="1.5"
            />
          </button>
        </li>
      </ul>

      <div v-if="hasLoaded && pageCount > 1" class="mt-3 border-t border-line-2 pt-2">
        <ListPagination v-model:page="page" :total="total" :items-per-page="itemsPerPage" />
      </div>

      <p v-else-if="isPending" class="text-[12.5px] text-ink-5">Wird geladen …</p>

      <p v-else-if="isError" class="text-[12.5px] text-ink-5">
        Die Mitteilungen lassen sich gerade nicht laden. Versuche es später noch einmal.
      </p>
    </DialogScrollContent>
  </Dialog>
</template>
