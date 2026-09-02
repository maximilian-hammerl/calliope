<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useQueryClient } from '@tanstack/vue-query'
import { getListFoldersQueryKey, useCreateFolder, useUpdateFolder } from '@/api/folders/folders'
import { TEXT_LIMIT } from '@/api/textLimit'
import { ApiError } from '@/lib/api/apiFetch'
import { failureMessage } from '@/lib/format/failure'
import { focusFirstInvalid, parsed, proseSchema, titleSchema } from '@/lib/validation/fieldSchemas'
import { formatCount } from '@/lib/format/formatNumber'
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
 * One dialog for both verbs, as a thread's is: an absent `folder` means creating, and then
 * `parentFolderId` says where. Where an existing folder sits is never changed here.
 */
/** Only what the fields need, so the tree can pass its own node without rebuilding an API row. */
export type EditableFolder = { id: string; title: string; description: string | null }

const props = defineProps<{
  groupId: string
  folder?: EditableFolder
  /** Null creates at the root. Ignored when renaming. */
  parentFolderId?: string | null
}>()
const open = defineModel<boolean>('open', { required: true })

const queryClient = useQueryClient()

const renaming = computed<boolean>(() => props.folder !== undefined)

const LIMIT = TEXT_LIMIT.createFolder

const TITLE = titleSchema(LIMIT.title, 'Gib dem Ordner einen Titel.')
const DESCRIPTION = proseSchema(
  LIMIT.description,
  `Der Text darf höchstens ${formatCount(LIMIT.description.maxLength)} Zeichen haben.`,
)

const formError = ref<string | undefined>(undefined)
const formElement = ref<HTMLFormElement | null>(null)

const { mutateAsync: createFolder, isPending: isCreating } = useCreateFolder()
const { mutateAsync: updateFolder, isPending: isRenaming } = useUpdateFolder()
const isPending = computed<boolean>(() => isCreating.value || isRenaming.value)

const form = useForm({
  defaultValues: { title: '', description: '' },
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined
    const title = parsed(TITLE, value.title)
    // Empty means no description, which the API takes as null — the only way back to none.
    const described = parsed(DESCRIPTION, value.description)
    const description = described.length === 0 ? null : described

    try {
      if (props.folder !== undefined) {
        await updateFolder({
          groupId: props.groupId,
          folderId: props.folder.id,
          data: { title, description },
        })
      } else {
        await createFolder({
          groupId: props.groupId,
          data: { title, description, parentFolderId: props.parentFolderId ?? undefined },
        })
      }
    } catch (error) {
      if (error instanceof ApiError && error.body.code === 'folder_too_deep') {
        formError.value = 'Tiefer geht es nicht. Leg den Ordner eine Ebene höher an.'
        return
      }
      formError.value = failureMessage(
        error,
        renaming.value
          ? 'Der Ordner konnte nicht geändert werden. Versuche es noch einmal.'
          : 'Der Ordner konnte nicht angelegt werden. Versuche es noch einmal.',
      )
      return
    }

    await queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey(props.groupId) })
    open.value = false
  },
})

// Opening fills the fields from the folder being renamed; closing clears them either way.
watch(open, (isOpen) => {
  formError.value = undefined
  form.reset({
    title: isOpen ? (props.folder?.title ?? '') : '',
    description: isOpen ? (props.folder?.description ?? '') : '',
  })
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-dialog-form">
      <DialogHeader>
        <DialogTitle>{{ renaming ? 'Ordner bearbeiten' : 'Ordner anlegen' }}</DialogTitle>
        <DialogDescription>
          Ein Ordner sammelt Themen, Seiten und weitere Ordner — etwa Weltenbau, darin Stadt A.
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
                id="folder-title"
                :field="field"
                label="Titel"
                :maxlength="LIMIT.title.maxLength"
                placeholder="z. B. Weltenbau"
                required
              />
            </template>
          </form.Field>

          <form.Field name="description" :validators="{ onSubmit: DESCRIPTION }">
            <template v-slot="{ field }">
              <FormTextField
                id="folder-description"
                :field="field"
                label="Beschreibung"
                :maxlength="LIMIT.description.maxLength"
                placeholder="Was gehört hier hinein?"
                multiline
                optional
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
            {{ renaming ? 'Änderungen speichern' : 'Ordner anlegen' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
