<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import {
  getGetThreadQueryKey,
  getListThreadsQueryKey,
  useCreateThread,
  useUpdateThread,
} from '@/api/threads/threads'
import type { GetThread200 } from '@/api/models'
import { TEXT_LIMIT } from '@/api/textLimit'
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
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

/**
 * One dialog for both verbs: an absent `thread` means creating. Two components would share
 * everything but the mutation, which is how the group dialogs drifted.
 */
const props = defineProps<{ groupId: string; thread?: GetThread200 }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [threadId: string] }>()

const queryClient = useQueryClient()

const renaming = computed<boolean>(() => props.thread !== undefined)

const LIMIT = TEXT_LIMIT.createThread

const title = ref<string>('')
const titleError = ref<string | undefined>(undefined)
const formError = ref<string | undefined>(undefined)

const { mutateAsync: createThread, isPending: isCreating } = useCreateThread()
const { mutateAsync: updateThread, isPending: isRenaming } = useUpdateThread()
const isPending = computed<boolean>(() => isCreating.value || isRenaming.value)

// Opening fills the field from the thread being renamed; closing clears it either way.
watch(open, (isOpen) => {
  if (isOpen) {
    title.value = props.thread?.title ?? ''
    titleError.value = undefined
    formError.value = undefined
    return
  }
  title.value = ''
  titleError.value = undefined
  formError.value = undefined
})

async function submit() {
  titleError.value = undefined
  formError.value = undefined

  if (title.value.trim().length === 0) {
    titleError.value = 'Gib dem Thread einen Titel.'
    return
  }

  const trimmed = title.value.trim()

  if (props.thread !== undefined) {
    try {
      await updateThread({
        groupId: props.groupId,
        threadId: props.thread.id,
        data: { title: trimmed },
      })
    } catch {
      formError.value = 'Der Thread konnte nicht umbenannt werden. Versuche es noch einmal.'
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
    created = await createThread({ groupId: props.groupId, data: { title: trimmed } })
  } catch {
    formError.value = 'Der Thread konnte nicht angelegt werden. Versuche es noch einmal.'
    return
  }

  await queryClient.invalidateQueries({
    queryKey: getListThreadsQueryKey(props.groupId),
  })
  open.value = false

  // Where to go afterwards belongs to the caller: the group opens the new thread, and a
  // rename leaves the reader where they were.
  if (created.status === 201) {
    emit('created', created.data.id)
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>{{ renaming ? 'Thread umbenennen' : 'Thread anlegen' }}</DialogTitle>
        <DialogDescription>
          Ein Thread sammelt zusammengehörende Beiträge, etwa der Plot, Steckbriefe, Planung oder
          Inspiration.
        </DialogDescription>
      </DialogHeader>

      <form class="flex flex-col gap-5" novalidate @submit.prevent="submit">
        <Alert v-if="formError" variant="destructive" role="alert">
          <AlertDescription>{{ formError }}</AlertDescription>
        </Alert>

        <FieldGroup>
          <Field :data-invalid="titleError !== undefined ? true : undefined">
            <FieldLabel for="thread-title">Titel</FieldLabel>
            <Input
              id="thread-title"
              v-model="title"
              class="h-11 md:h-9"
              name="title"
              :maxlength="LIMIT.title.maxLength"
              placeholder="z. B. Plot oder Steckbriefe"
              required
              :aria-invalid="titleError !== undefined ? true : undefined"
            />
            <FieldError :errors="[titleError]" />
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button type="button" variant="outline" :disabled="isPending" @click="open = false">
            Abbrechen
          </Button>
          <Button type="submit" :disabled="isPending">
            <Spinner v-if="isPending" data-icon="inline-start" />
            {{ renaming ? 'Änderungen speichern' : 'Thread anlegen' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
