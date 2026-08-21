<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { getListThreadsQueryKey, useCreateThread } from '@/api/threads/threads'
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

const props = defineProps<{ groupId: string }>()
const open = defineModel<boolean>('open', { required: true })

const router = useRouter()
const queryClient = useQueryClient()

const LIMIT = TEXT_LIMIT.createThread

const title = ref<string>('')
const titleError = ref<string | undefined>(undefined)
const formError = ref<string | undefined>(undefined)

const { mutateAsync: createThread, isPending } = useCreateThread()

watch(open, (isOpen) => {
  if (isOpen) {
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

  let created
  try {
    created = await createThread({ groupId: props.groupId, data: { title: title.value.trim() } })
  } catch {
    formError.value = 'Der Thread konnte nicht angelegt werden. Versuche es noch einmal.'
    return
  }

  await queryClient.invalidateQueries({
    queryKey: getListThreadsQueryKey(props.groupId),
  })
  open.value = false

  if (created.status === 201) {
    await router.push({
      name: 'thread',
      params: { groupId: props.groupId, threadId: created.data.id },
    })
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>Thread anlegen</DialogTitle>
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
            Thread anlegen
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
