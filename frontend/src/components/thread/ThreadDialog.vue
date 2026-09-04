<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useQueryClient } from '@tanstack/vue-query'
import {
  getGetThreadQueryKey,
  getListThreadsQueryKey,
  useCreateThread,
  useUpdateThread,
} from '@/api/threads/threads'
import type { GetThread200 } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
import { getListForumThreadsQueryKey, useCreateForumThread } from '@/api/forum/forum'
import { exactKeyFilter } from '@/lib/api/queryKeys'
import type { WriteScope } from '@/lib/folder/treeScope'
import { failureMessage } from '@/lib/format/failure'
import { focusFirstInvalid, parsed, titleSchema } from '@/lib/validation/fieldSchemas'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import FormTextField from '@/components/common/FormTextField.vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FieldGroup } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'

/**
 * One dialog for both verbs: an absent `thread` means creating. Two components would share
 * everything but the mutation, which is how the group dialogs drifted.
 */
const props = defineProps<{
  /**
   * Which tree this thread joins. A thema means the same thing in a writing group and in the
   * public forum (#32), so the copy below is written once and the scope branches around it.
   */
  scope: WriteScope
  /** Renaming, which is a group's for now: the forum's rename arrives with its moderation. */
  thread?: GetThread200
  /** Absent creates at the root of the tree, which in the forum only an operator may write to. */
  folderId?: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [threadId: string] }>()

const queryClient = useQueryClient()

const renaming = computed<boolean>(() => props.thread !== undefined)

const LIMIT = props.scope.kind === 'forum' ? TEXT_LIMIT.createForumThread : TEXT_LIMIT.createThread

/**
 * Said where it is decided, not in the tree afterwards: a leaf with no folder above it is
 * clamped to `read` for members, and no setting on the row itself can lift that.
 */
const ROOT_NOTE =
  'Ohne Ordner liegt das Thema oben im Forum — Mitglieder können es dann lesen, aber nicht beantworten.'

/** Only an operator is offered the root, so the note is theirs. */
const atForumRoot = computed<boolean>(
  () => props.scope.kind === 'forum' && props.folderId === undefined,
)

const TITLE = titleSchema(LIMIT.title, 'Gib dem Thema einen Titel.')

const formError = ref<string | undefined>(undefined)
const formElement = ref<HTMLFormElement | null>(null)

const { mutateAsync: createThread, isPending: isCreatingInGroup } = useCreateThread()
const { mutateAsync: createForumThread, isPending: isCreatingInForum } = useCreateForumThread()
const isCreating = computed<boolean>(() => isCreatingInGroup.value || isCreatingInForum.value)
const { mutateAsync: updateThread, isPending: isRenaming } = useUpdateThread()
const isPending = computed<boolean>(() => isCreating.value || isRenaming.value)

const form = useForm({
  defaultValues: { title: '' },
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined
    const title = parsed(TITLE, value.title)

    if (props.thread !== undefined && props.scope.kind === 'group') {
      const { groupId } = props.scope
      try {
        await updateThread({ groupId, threadId: props.thread.id, data: { title } })
      } catch (error) {
        formError.value = failureMessage(
          error,
          'Das Thema konnte nicht umbenannt werden. Versuche es noch einmal.',
        )
        return
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetThreadQueryKey(groupId, props.thread.id),
        }),
        queryClient.invalidateQueries(exactKeyFilter(getListThreadsQueryKey(groupId))),
      ])
      open.value = false
      return
    }

    const data = { title, folderId: props.folderId }

    let created
    try {
      created =
        props.scope.kind === 'forum'
          ? await createForumThread({ data })
          : await createThread({ groupId: props.scope.groupId, data })
    } catch (error) {
      formError.value = failureMessage(
        error,
        'Das Thema konnte nicht angelegt werden. Versuche es noch einmal.',
      )
      return
    }

    await queryClient.invalidateQueries(
      props.scope.kind === 'forum'
        ? exactKeyFilter(getListForumThreadsQueryKey())
        : exactKeyFilter(getListThreadsQueryKey(props.scope.groupId)),
    )
    open.value = false

    // Where to go afterwards belongs to the caller: the group opens the new thread, and a
    // rename leaves the reader where they were.
    if (created.status === 201) {
      emit('created', created.data.id)
    }
  },
})

// Opening fills the field from the thread being renamed; closing clears it either way.
watch(open, (isOpen) => {
  formError.value = undefined
  form.reset({ title: isOpen ? (props.thread?.title ?? '') : '' })
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>{{ renaming ? 'Thema umbenennen' : 'Thema anlegen' }}</DialogTitle>
        <DialogDescription>
          Viele Beiträge, einer nach dem anderen — zum Erzählen, Planen und Besprechen. Jeder
          Beitrag gehört dem, der ihn geschrieben hat. Für einen Text, den ihr gemeinsam pflegt,
          nimm eine Seite.
        </DialogDescription>
      </DialogHeader>

      <!-- A quiet note rather than an Alert: it is context for the whole dialog, not a failure,
           and only an operator can open this at the root, so it is addressed to them. -->
      <p v-if="atForumRoot" class="text-note text-ink-5">{{ ROOT_NOTE }}</p>

      <form
        ref="formElement"
        class="flex flex-col gap-5"
        novalidate
        @submit.prevent="form.handleSubmit()"
      >
        <Alert v-if="formError" variant="destructive" role="alert">
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <FieldGroup>
          <form.Field name="title" :validators="{ onSubmit: TITLE }">
            <template v-slot="{ field }">
              <FormTextField
                id="thread-title"
                :field="field"
                label="Titel"
                :maxlength="LIMIT.title.maxLength"
                placeholder="z. B. Plot oder Steckbriefe"
                required
              />
            </template>
          </form.Field>
        </FieldGroup>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isPending" @click="open = false">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="isPending">
            <Spinner v-if="isPending" />
            {{ renaming ? 'Änderungen speichern' : 'Thema anlegen' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
