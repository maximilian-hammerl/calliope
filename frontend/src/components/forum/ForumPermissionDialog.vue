<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import {
  getListForumPagesQueryKey,
  getListForumThreadsQueryKey,
  useSetForumPermission,
} from '@/api/forum/forum'
import { exactKeyFilter } from '@/lib/api/queryKeys'
import { failureMessage } from '@/lib/format/failure'
import type { ForumPermission } from '@/lib/format/forum'
import ForumPermissionField from '@/components/forum/ForumPermissionField.vue'
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
import { Spinner } from '@/components/ui/spinner'

/**
 * What members may do with one thread or page, for the operators who decide it (#32's slice 7).
 *
 * Its own dialog rather than a field inside the thread's rename or the page's editor: those are
 * an author's and a writer's, this is an operator's — and on the wire it is one endpoint over
 * three kinds, so one control matches what actually happens.
 */
const props = defineProps<{
  targetType: 'thread' | 'page'
  targetId: string
  /** Its own setting, so the dialog opens on what was chosen rather than on what applies. */
  memberPermission: ForumPermission
  /** Named in the heading, so it is clear which thread is being closed. */
  title: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ changed: [] }>()

const queryClient = useQueryClient()

const permission = ref<ForumPermission>(props.memberPermission)
const formError = ref<string | undefined>(undefined)

const { mutateAsync: setPermission, isPending } = useSetForumPermission()

const unchanged = computed<boolean>(() => permission.value === props.memberPermission)

async function save() {
  formError.value = undefined

  // Nothing to send when nothing moved, the rule the notification producers follow.
  if (unchanged.value) {
    open.value = false
    return
  }

  try {
    await setPermission({
      targetType: props.targetType,
      targetId: props.targetId,
      data: { memberPermission: permission.value },
    })
  } catch (error) {
    formError.value = failureMessage(
      error,
      'Die Rechte konnten nicht geändert werden. Versuche es noch einmal.',
    )
    return
  }

  // Both lists, because the tree and the rail draw the mark from them.
  await Promise.all([
    queryClient.invalidateQueries(exactKeyFilter(getListForumThreadsQueryKey())),
    queryClient.invalidateQueries(exactKeyFilter(getListForumPagesQueryKey())),
  ])

  // What the reader is looking at is the caller's to refetch: it holds that query, not this.
  emit('changed')
  open.value = false
}

// Opening resets to what is stored, so a cancelled change is not still shown next time.
watch(open, (isOpen) => {
  formError.value = undefined
  if (isOpen) permission.value = props.memberPermission
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>Rechte für „{{ props.title }}“</DialogTitle>
        <DialogDescription>
          Gilt für Mitglieder. Was der Ordner darüber erlaubt, gilt zusätzlich — ein geschlossener
          Ordner bleibt geschlossen, auch wenn hier mehr steht.
        </DialogDescription>
      </DialogHeader>

      <Alert v-if="formError" variant="destructive" role="alert">
        <AlertDescription>{{ formError }}</AlertDescription>
      </Alert>

      <ForumPermissionField v-model="permission" :kind="props.targetType" />

      <DialogFooter>
        <Button type="button" variant="outline" :disabled="isPending" @click="open = false">
          Abbrechen
        </Button>
        <Button type="button" :disabled="isPending" @click="save">
          <Spinner v-if="isPending" />
          Speichern
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
