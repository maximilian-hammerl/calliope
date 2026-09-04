<script setup lang="ts">
/**
 * One dialog for both verbs, as a thread's is: an absent `folder` means creating, and then
 * `parentFolderId` says where. Where an existing folder sits is never changed here.
 */
import { computed, ref, watch } from 'vue'
import { useForm } from '@tanstack/vue-form'
import { useQueryClient } from '@tanstack/vue-query'
import { getListFoldersQueryKey, useCreateFolder, useUpdateFolder } from '@/api/folders/folders'
import {
  getListForumFoldersQueryKey,
  getListForumPagesQueryKey,
  getListForumThreadsQueryKey,
  useCreateForumFolder,
  useSetForumPermission,
  useUpdateForumFolder,
} from '@/api/forum/forum'
import { exactKeyFilter } from '@/lib/api/queryKeys'
import type { WriteScope } from '@/lib/folder/treeScope'
import type { ForumPermission } from '@/lib/format/forum'
import { pluralize } from '@/lib/format/formatText'
import ForumPermissionField from '@/components/forum/ForumPermissionField.vue'
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
 * Only what the fields need, so the tree can pass its own node without rebuilding an API row.
 * `memberPermission` is the forum's, and it is the row's *own* setting: a folder above it can
 * still close it, which is why the dialog shows what was chosen rather than what applies.
 */
export type EditableFolder = {
  id: string
  title: string
  description: string | null
  memberPermission?: ForumPermission
}

const props = defineProps<{
  scope: WriteScope
  folder?: EditableFolder
  /** Null creates at the root. Ignored when renaming. */
  parentFolderId?: string | null
  /**
   * What the folder holds, for the warning below. The caller counts it, because it has the tree
   * already loaded and this dialog should not fetch one.
   */
  holds?: { threads: number; pages: number }
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
const { mutateAsync: createForumFolder, isPending: isCreatingInForum } = useCreateForumFolder()
const { mutateAsync: updateForumFolder, isPending: isRenamingInForum } = useUpdateForumFolder()
const { mutateAsync: setPermission, isPending: isSettingPermission } = useSetForumPermission()

const isPending = computed<boolean>(
  () =>
    isCreating.value ||
    isRenaming.value ||
    isCreatingInForum.value ||
    isRenamingInForum.value ||
    isSettingPermission.value,
)

/**
 * The forum's rooms carry one, and it is required rather than defaulted on a create: what members
 * may do here is the whole point of a room, so it is asked rather than assumed.
 */
const permission = ref<ForumPermission>('write')

const inForum = computed<boolean>(() => props.scope.kind === 'forum')

/** Said as a count, because one choice changes what a whole subtree grants. */
const hides = computed<string | undefined>(() => {
  if (!inForum.value || permission.value !== 'hidden' || props.holds === undefined) return undefined

  const { threads, pages } = props.holds
  if (threads + pages === 0) return 'Der Ordner ist leer.'

  const parts = [
    threads > 0 ? pluralize(threads, 'Thema', 'Themen') : undefined,
    pages > 0 ? pluralize(pages, 'Seite', 'Seiten') : undefined,
  ].filter((part) => part !== undefined)

  return `Verbirgt ${parts.join(' und ')} für Mitglieder.`
})

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
      if (props.scope.kind === 'forum') {
        await saveInForum(title, description)
      } else if (props.folder !== undefined) {
        await updateFolder({
          groupId: props.scope.groupId,
          folderId: props.folder.id,
          data: { title, description },
        })
      } else {
        await createFolder({
          groupId: props.scope.groupId,
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

    await queryClient.invalidateQueries(
      props.scope.kind === 'forum'
        ? exactKeyFilter(getListForumFoldersQueryKey())
        : { queryKey: getListFoldersQueryKey(props.scope.groupId) },
    )
    // A permission change reaches the leaves through their folder, so their lists move too.
    if (props.scope.kind === 'forum') {
      await refreshForumLeaves()
    }
    open.value = false
  },
})

/**
 * Two requests when renaming, because a permission is its own endpoint: it carries a subtree with
 * it and must not hide inside a rename. Only sent when the value actually moved, which is the rule
 * the notification producers follow for the same reason.
 */
async function saveInForum(title: string, description: string | null): Promise<void> {
  if (props.folder === undefined) {
    await createForumFolder({
      data: {
        title,
        description,
        parentFolderId: props.parentFolderId ?? undefined,
        memberPermission: permission.value,
      },
    })
    return
  }

  await updateForumFolder({ folderId: props.folder.id, data: { title, description } })

  if (permission.value !== props.folder.memberPermission) {
    await setPermission({
      targetType: 'folder',
      targetId: props.folder.id,
      data: { memberPermission: permission.value },
    })
  }
}

/** What a folder's permission reaches: the threads and pages under it read it through their own. */
async function refreshForumLeaves(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries(exactKeyFilter(getListForumThreadsQueryKey())),
    queryClient.invalidateQueries(exactKeyFilter(getListForumPagesQueryKey())),
  ])
}

// Opening fills the fields from the folder being renamed; closing clears them either way.
watch(open, (isOpen) => {
  formError.value = undefined
  permission.value = isOpen ? (props.folder?.memberPermission ?? 'write') : 'write'
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

        <!-- The forum's rooms only: a writing group's folders grant what the group grants, so
             there is nothing here to choose. -->
        <ForumPermissionField v-if="inForum" v-model="permission" kind="folder">
          <template #warning>
            <!-- What one choice costs, as a number: hiding a room hides its whole subtree, and
                 nothing else on screen says so. -->
            <p v-if="hides" class="text-note text-ink-4">{{ hides }}</p>
          </template>
        </ForumPermissionField>

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
