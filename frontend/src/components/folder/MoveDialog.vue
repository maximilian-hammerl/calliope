<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { getListFoldersQueryKey, useMoveFolder } from '@/api/folders/folders'
import { getListPagesQueryKey, useMovePage } from '@/api/pages/pages'
import { getListThreadsQueryKey, useMoveThread } from '@/api/threads/threads'
import { ApiError } from '@/lib/api/apiFetch'
import { failureMessage } from '@/lib/format/failure'
import { moveTargets } from '@/lib/folder/moveTargets'
import type { TreeNode } from '@/lib/folder/buildTree'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'

/** What is being moved, in the terms the tree already has. */
export type Movable = {
  kind: 'folder' | 'page' | 'thread'
  id: string
  title: string
  /** Where it sits now, so the current place is marked and re-choosing it does nothing. */
  parentId: string | null
}

const props = defineProps<{ groupId: string; tree: TreeNode[]; item?: Movable }>()
const open = defineModel<boolean>('open', { required: true })

const queryClient = useQueryClient()

/**
 * A folder cannot go inside itself, so its own subtree is left out. Everything else is offered
 * and the API decides: the depth limit lives there, and repeating the number here is what we
 * agreed not to do.
 */
const targets = computed(() =>
  moveTargets(props.tree, props.item?.kind === 'folder' ? props.item.id : undefined),
)

/** Bound to the radio group; `__root__` stands in for null, which a radio value cannot be. */
const ROOT = '__root__'
const chosen = ref<string>(ROOT)

const moveError = ref<string | undefined>(undefined)

const { mutateAsync: moveFolder, isPending: movingFolder } = useMoveFolder()
const { mutateAsync: movePage, isPending: movingPage } = useMovePage()
const { mutateAsync: moveThread, isPending: movingThread } = useMoveThread()
const isPending = computed<boolean>(
  () => movingFolder.value || movingPage.value || movingThread.value,
)

const unchanged = computed<boolean>(
  () => (chosen.value === ROOT ? null : chosen.value) === (props.item?.parentId ?? null),
)

watch(open, (isOpen) => {
  moveError.value = undefined
  chosen.value = isOpen ? (props.item?.parentId ?? ROOT) : ROOT
})

async function move() {
  const item = props.item
  if (item === undefined) return

  const target = chosen.value === ROOT ? null : chosen.value
  moveError.value = undefined

  try {
    if (item.kind === 'folder') {
      await moveFolder({
        groupId: props.groupId,
        folderId: item.id,
        data: { parentFolderId: target },
      })
    } else if (item.kind === 'page') {
      await movePage({ groupId: props.groupId, pageId: item.id, data: { folderId: target } })
    } else {
      await moveThread({ groupId: props.groupId, threadId: item.id, data: { folderId: target } })
    }
  } catch (error) {
    if (error instanceof ApiError && error.body.code === 'folder_too_deep') {
      moveError.value = 'Dort wird es zu tief. Was in diesem Ordner liegt, zählt mit.'
      return
    }
    if (error instanceof ApiError && error.body.code === 'folder_cycle') {
      moveError.value = 'Ein Ordner kann nicht in sich selbst liegen.'
      return
    }
    moveError.value = failureMessage(
      error,
      `„${item.title}“ konnte nicht verschoben werden. Versuche es noch einmal.`,
    )
    return
  }

  // All three lists feed the tree, and a move changes which of them the reader sees where.
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey(props.groupId) }),
    queryClient.invalidateQueries({ queryKey: getListPagesQueryKey(props.groupId) }),
    queryClient.invalidateQueries({ queryKey: getListThreadsQueryKey(props.groupId) }),
  ])
  open.value = false
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>„{{ item?.title }}“ verschieben</DialogTitle>
        <DialogDescription>
          <template v-if="item?.kind === 'folder'"> Alles, was darin liegt, geht mit. </template>
          <template v-else>Wähle, wo es künftig liegen soll.</template>
        </DialogDescription>
      </DialogHeader>

      <Alert v-if="moveError" variant="destructive" role="alert">
        <AlertDescription>{{ moveError }}</AlertDescription>
      </Alert>

      <RadioGroup v-model="chosen" class="gap-0" aria-label="Zielordner">
        <label
          v-for="target in targets"
          :key="target.id ?? ROOT"
          class="flex min-h-11 items-center gap-2.5 text-body text-ink-3 md:min-h-0 md:py-[5px]"
          :style="{ paddingLeft: `${target.level * 16}px` }"
        >
          <RadioGroupItem :value="target.id ?? ROOT" />
          <span class="truncate">{{ target.title }}</span>
          <span
            v-if="(target.id ?? null) === (item?.parentId ?? null)"
            class="text-[11.5px] text-ink-6"
          >
            aktuell
          </span>
        </label>
      </RadioGroup>

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="isPending" @click="open = false">
          Abbrechen
        </Button>
        <Button type="button" :disabled="isPending || unchanged" @click="move">
          <Spinner v-if="isPending" />
          Verschieben
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
