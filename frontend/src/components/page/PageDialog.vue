<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useQueryClient } from '@tanstack/vue-query'
import { getListPagesQueryKey, useCreatePage } from '@/api/pages/pages'
import { getListForumPagesQueryKey, useCreateForumPage } from '@/api/forum/forum'
import { exactKeyFilter } from '@/lib/api/queryKeys'
import type { WriteScope } from '@/lib/folder/treeScope'
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
  /**
   * Which tree this page joins. The copy below is the same product either way — a page means the
   * same thing in a writing group and in the public forum (#32) — so the scope branches around
   * it rather than a second dialog repeating it.
   */
  scope: WriteScope
  /** Absent creates at the root of the tree, which in the forum only an operator may write to. */
  folderId?: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [pageId: string] }>()

const queryClient = useQueryClient()

const LIMIT = props.scope.kind === 'forum' ? TEXT_LIMIT.createForumPage : TEXT_LIMIT.createPage

/**
 * Said where it is decided, not in the tree afterwards: a leaf with no folder above it is
 * clamped to `read` for members, and no setting on the row itself can lift that.
 */
const ROOT_NOTE =
  'Ohne Ordner liegt die Seite oben im Forum — Mitglieder können sie dann lesen, aber nicht bearbeiten.'

/** Only an operator is offered the root, so the note is theirs. */
const atForumRoot = computed<boolean>(
  () => props.scope.kind === 'forum' && props.folderId === undefined,
)

const TITLE = titleSchema(LIMIT.title, 'Gib der Seite einen Titel.')

const formError = ref<string | undefined>(undefined)
const formElement = ref<HTMLFormElement | null>(null)

const { mutateAsync: createPage, isPending: isCreatingInGroup } = useCreatePage()
const { mutateAsync: createForumPage, isPending: isCreatingInForum } = useCreateForumPage()
const isPending = computed<boolean>(() => isCreatingInGroup.value || isCreatingInForum.value)

const form = useForm({
  defaultValues: { title: '' },
  onSubmitInvalid: () => focusFirstInvalid(formElement.value),
  onSubmit: async ({ value }) => {
    formError.value = undefined

    const data = {
      title: parsed(TITLE, value.title),
      document: emptyDocument(),
      folderId: props.folderId,
    }

    let created
    try {
      created =
        props.scope.kind === 'forum'
          ? await createForumPage({ data })
          : await createPage({ groupId: props.scope.groupId, data })
    } catch (error) {
      formError.value = failureMessage(
        error,
        'Die Seite konnte nicht angelegt werden. Versuche es noch einmal.',
      )
      return
    }

    // The list and nothing under it: its key is a prefix of every page's own, so a bare key here
    // refetched each page the reader had open.
    await queryClient.invalidateQueries(
      props.scope.kind === 'forum'
        ? exactKeyFilter(getListForumPagesQueryKey())
        : exactKeyFilter(getListPagesQueryKey(props.scope.groupId)),
    )
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
          Ein Text, den alle gemeinsam schreiben und ändern — ein Ort, eine Figur, eine Regel.
          Anders als ein Thema sammelt eine Seite keine Beiträge; sie bleibt ein Text. Den schreibst
          du auf der Seite selbst.
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
