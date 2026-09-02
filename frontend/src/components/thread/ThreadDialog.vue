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
  groupId: string
  thread?: GetThread200
  /** Absent creates at the root of the group's tree. Ignored when renaming. */
  folderId?: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [threadId: string] }>()

const queryClient = useQueryClient()

const renaming = computed<boolean>(() => props.thread !== undefined)

const LIMIT = TEXT_LIMIT.createThread

const TITLE = titleSchema(LIMIT.title, 'Gib dem Thema einen Titel.')

const formError = ref<string | undefined>(undefined)
const formElement = ref<HTMLFormElement | null>(null)

const { mutateAsync: createThread, isPending: isCreating } = useCreateThread()
const { mutateAsync: updateThread, isPending: isRenaming } = useUpdateThread()
const isPending = computed<boolean>(() => isCreating.value || isRenaming.value)

const form = useForm({
  defaultValues: { title: '' },
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined
    const title = parsed(TITLE, value.title)

    if (props.thread !== undefined) {
      try {
        await updateThread({
          groupId: props.groupId,
          threadId: props.thread.id,
          data: { title },
        })
      } catch (error) {
        formError.value = failureMessage(
          error,
          'Das Thema konnte nicht umbenannt werden. Versuche es noch einmal.',
        )
        return
      }

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetThreadQueryKey(props.groupId, props.thread.id),
        }),
        queryClient.invalidateQueries({ queryKey: getListThreadsQueryKey(props.groupId) }),
      ])
      open.value = false
      return
    }

    let created
    try {
      created = await createThread({
        groupId: props.groupId,
        data: { title, folderId: props.folderId },
      })
    } catch (error) {
      formError.value = failureMessage(
        error,
        'Das Thema konnte nicht angelegt werden. Versuche es noch einmal.',
      )
      return
    }

    await queryClient.invalidateQueries({ queryKey: getListThreadsQueryKey(props.groupId) })
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
          Ein Thema sammelt zusammengehörende Beiträge, etwa der Plot, Steckbriefe, Planung oder
          Inspiration.
        </DialogDescription>
      </DialogHeader>

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
