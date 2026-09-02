<script setup lang="ts">
import { ref, watch } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useQueryClient } from '@tanstack/vue-query'
import { getListPagesQueryKey, useCreatePage } from '@/api/pages/pages'
import { TEXT_LIMIT } from '@/api/textLimit'
import { failureMessage } from '@/lib/format/failure'
import { focusFirstInvalid, parsed, titleSchema } from '@/lib/validation/fieldSchemas'
import { emptyDocument } from '@/lib/document/emptyDocument'
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
 * Only the title, as a thread's dialog is: the body is written on the page itself, where the
 * editor has the column's width. So a page starts empty, which the API allows for a page
 * because its title already says what it is.
 */
const props = defineProps<{
  groupId: string
  /** Absent creates at the root of the group's tree. */
  folderId?: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [pageId: string] }>()

const queryClient = useQueryClient()

const LIMIT = TEXT_LIMIT.createPage

const TITLE = titleSchema(LIMIT.title, 'Gib der Seite einen Titel.')

const formError = ref<string | undefined>(undefined)
const formElement = ref<HTMLFormElement | null>(null)

const { mutateAsync: createPage, isPending } = useCreatePage()

const form = useForm({
  defaultValues: { title: '' },
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined

    let created
    try {
      created = await createPage({
        groupId: props.groupId,
        data: {
          title: parsed(TITLE, value.title),
          document: emptyDocument(),
          folderId: props.folderId,
        },
      })
    } catch (error) {
      formError.value = failureMessage(
        error,
        'Die Seite konnte nicht angelegt werden. Versuche es noch einmal.',
      )
      return
    }

    await queryClient.invalidateQueries({ queryKey: getListPagesQueryKey(props.groupId) })
    open.value = false

    // The caller opens it, so the member lands where the writing happens.
    if (created.status === 201) {
      emit('created', created.data.id)
    }
  },
})

watch(open, () => {
  formError.value = undefined
  form.reset({ title: '' })
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>Seite anlegen</DialogTitle>
        <DialogDescription>
          Eine Seite hält fest, was die Gruppe pflegt — einen Ort, eine Figur, eine Regel. Den Text
          schreibst du auf der Seite selbst.
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
                id="page-title"
                :field="field"
                label="Titel"
                :maxlength="LIMIT.title.maxLength"
                placeholder="z. B. Stadt A oder Figur B"
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
            Seite anlegen
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
