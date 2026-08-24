<script setup lang="ts">
/**
 * Where a block is undone. The profile is where one is made, but a blocked member is exactly
 * the person you no longer visit, so the list has to live somewhere you can reach without them.
 */
import { computed, ref } from 'vue'
import { getListBlocksQueryKey, useListBlocks, useUnblockMember } from '@/api/blocks/blocks'
import type { ListBlocks200ResultsItem } from '@/api/models'
import { queryClient } from '@/lib/api/queryClient'
import { listKeyPrefix } from '@/lib/api/queryKeys'
import { formatJoinedDate } from '@/lib/format/formatTime'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

const { data, isPending } = useListBlocks(() => ({ limit: 100 }))

const blocks = computed<ListBlocks200ResultsItem[]>(() =>
  data.value?.status === 200 ? data.value.data.results : [],
)

const { mutateAsync: unblock } = useUnblockMember()
/** Per row, so one slow request does not disable every other button in the list. */
const pendingId = ref<string | undefined>(undefined)
const error = ref<string | undefined>(undefined)

async function allowContactAgain(userId: string) {
  error.value = undefined
  pendingId.value = userId
  try {
    await unblock({ userId })
    await queryClient.invalidateQueries({ queryKey: listKeyPrefix(getListBlocksQueryKey()) })
  } catch {
    error.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
  } finally {
    pendingId.value = undefined
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-note text-ink-4">
      Wen du blockiert hast. Ihr könnt euch nicht einladen; gemeinsame Gruppen und Chats bleiben,
      bis eine Seite sie verlässt.
    </p>

    <Alert v-if="error" variant="destructive" role="alert">
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <div v-if="isPending" class="flex items-center gap-2 text-[13px] text-ink-5">
      <Spinner />
      Einen Moment.
    </div>

    <p v-else-if="blocks.length === 0" class="text-row text-ink-5">Du hast niemanden blockiert.</p>

    <ul v-else class="flex flex-col">
      <li
        v-for="(block, index) in blocks"
        :key="block.blockedId"
        class="flex flex-wrap items-center gap-3 py-3"
        :class="index > 0 ? 'border-t border-line-2' : ''"
      >
        <div class="flex min-w-0 flex-col">
          <span class="truncate text-[13.5px] text-ink-2">{{ block.username }}</span>
          <span class="text-[12px] text-ink-6">
            Blockiert seit {{ formatJoinedDate(block.createdAt) }}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          class="ml-auto"
          :disabled="pendingId === block.blockedId"
          @click="allowContactAgain(block.blockedId)"
        >
          Blockierung aufheben
        </Button>
      </li>
    </ul>
  </div>
</template>
