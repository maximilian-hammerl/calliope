<script setup lang="ts">
/**
 * One page of a group: reference material the group maintains, so it is read as prose and edited
 * as a whole. Not a thread — there are no posts, no per-member draft, and no order to choose.
 *
 * The save is conditional. A page has one shared body, so two members editing at once would
 * otherwise overwrite one another silently: the `updatedAt` that was loaded goes back with the
 * save, and a 409 names whoever wrote in the meantime rather than merging.
 */
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { Flag, Pencil, Trash2 } from '@lucide/vue'
import { ApiError } from '@/lib/api/apiFetch'
import { exactKeyFilter } from '@/lib/api/queryKeys'
import { failureMessage } from '@/lib/format/failure'
import { firstMessage, proseSchema, titleSchema } from '@/lib/validation/fieldSchemas'
import { formatActivityTime } from '@/lib/format/formatTime'
import { formatCount } from '@/lib/format/formatNumber'
import { useGroupContext } from '@/composables/useGroupContext'
import { useGetCurrentUser } from '@/api/auth/auth'
import {
  getGetPageQueryKey,
  getListPagesQueryKey,
  useDeletePage,
  useGetPage,
  useUpdatePage,
} from '@/api/pages/pages'
import { TEXT_LIMIT } from '@/api/textLimit'
import type { GetPage200, PostDocument } from '@/api/models'
import GroupHeader from '@/components/group/GroupHeader.vue'
import PostBody from '@/components/thread/PostBody.vue'
import PostEditor from '@/components/thread/PostEditor.vue'
import DeletePageDialog from '@/components/page/DeletePageDialog.vue'
import ReportDialog from '@/components/report/ReportDialog.vue'
import PathToHere from '@/components/folder/PathToHere.vue'
import { useFolderTree } from '@/composables/useFolderTree'
import FavouriteToggle from '@/components/favourite/FavouriteToggle.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()

const { groupId, group, mayWrite } = useGroupContext()

// For the breadcrumb, which takes the tree rather than fetching one: the three queries behind
// it are already loaded by the rail, so this costs no request.
const { tree } = useFolderTree(groupId)

const pageId = computed<string>(() => String(route.params.pageId))

const LIMIT = TEXT_LIMIT.updatePage

const TITLE = titleSchema(LIMIT.title, 'Gib der Seite einen Titel.')

// No minimum: a page named „Stadt A" with nothing in it yet is a stub, which the API allows.
const PAGE_TEXT = proseSchema(
  LIMIT.document,
  `Die Seite ist zu lang. Sie darf höchstens ${formatCount(LIMIT.document.maxLength)} Zeichen haben.`,
)

const { data: currentUserData } = useGetCurrentUser()
const currentUserId = computed<string | undefined>(() =>
  currentUserData.value?.status === 200 ? currentUserData.value.data.id : undefined,
)

const { data: pageData, isPending, isError } = useGetPage(groupId, pageId)
const page = computed<GetPage200 | undefined>(() =>
  pageData.value?.status === 200 ? pageData.value.data : undefined,
)

/** The page's own query, so the favourite mark follows a change to it. */
// The list too, as `ThreadView` does for a thread: the rail draws its favourite mark from the
// list, so refreshing only the page left the mark as it was.
async function refreshPage() {
  await queryClient.invalidateQueries({
    queryKey: getGetPageQueryKey(groupId.value, pageId.value),
  })
  await queryClient.invalidateQueries(exactKeyFilter(getListPagesQueryKey(groupId.value)))
}

const editing = ref<boolean>(false)
const draftTitle = ref<string>('')
const draftDocument = ref<PostDocument>({ type: 'doc', content: [{ type: 'paragraph' }] })
const draftText = ref<string>('')
const saveError = ref<string | undefined>(undefined)

const editor = useTemplateRef<{ focus: () => void }>('editor')

/**
 * What the save is conditional on: the `lastActivityAt` of the version being edited, kept as it was
 * received. Parsing it into a date and back would drop the microseconds the API compares.
 */
const loadedAt = ref<string | undefined>(undefined)

async function startEditing() {
  const current = page.value
  if (current === undefined) return

  saveError.value = undefined
  draftTitle.value = current.title
  // The stored document, never a rebuild from the prose: the projection carries no marks, so a
  // page with a heading in it would silently flatten.
  draftDocument.value = current.document
  draftText.value = ''
  loadedAt.value = current.lastActivityAt
  editing.value = true

  await nextTick()
  editor.value?.focus()
}

const { mutateAsync: updatePage, isPending: isSaving } = useUpdatePage()

async function save() {
  const at = loadedAt.value
  if (at === undefined) return

  saveError.value =
    firstMessage(TITLE.safeParse(draftTitle.value)) ??
    firstMessage(PAGE_TEXT.safeParse(draftText.value))
  if (saveError.value !== undefined) return

  try {
    await updatePage({
      groupId: groupId.value,
      pageId: pageId.value,
      data: { title: draftTitle.value.trim(), document: draftDocument.value, loadedAt: at },
    })
  } catch (error) {
    // The one refusal worth its own sentence: somebody else's version is now the stored one, and
    // what the member typed is still in front of them.
    if (error instanceof ApiError && error.body.code === 'page_changed') {
      const other = error.body.updatedByUsername
      saveError.value = other
        ? `${other} hat die Seite inzwischen bearbeitet. Lade sie neu — dein Text geht dabei verloren.`
        : 'Die Seite wurde inzwischen bearbeitet. Lade sie neu — dein Text geht dabei verloren.'
      return
    }
    saveError.value = failureMessage(
      error,
      'Die Seite konnte nicht gespeichert werden. Versuche es noch einmal.',
    )
    return
  }

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getGetPageQueryKey(groupId.value, pageId.value) }),
    queryClient.invalidateQueries(exactKeyFilter(getListPagesQueryKey(groupId.value))),
  ])
  editing.value = false
}

/** Reporting your own page is not a thing, and an absent reader cannot report at all. */
const mayReport = computed<boolean>(
  () => currentUserId.value !== undefined && page.value?.createdBy !== currentUserId.value,
)

const reportingPage = ref<boolean>(false)

const deleting = ref<boolean>(false)
const deleteError = ref<string | undefined>(undefined)

const { mutateAsync: deletePage, isPending: isDeleting } = useDeletePage()

async function confirmDelete() {
  deleteError.value = undefined
  try {
    await deletePage({ groupId: groupId.value, pageId: pageId.value })
  } catch (error) {
    deleteError.value = failureMessage(
      error,
      'Die Seite konnte nicht gelöscht werden. Versuche es noch einmal.',
    )
    return
  }

  await queryClient.invalidateQueries(exactKeyFilter(getListPagesQueryKey(groupId.value)))
  void router.push({ name: 'group', params: { groupId: groupId.value } })
}

/** Who last wrote it, which is what a group maintaining a page together wants to see. */
const meta = computed<string>(() => {
  const current = page.value
  if (current === undefined) return ''

  const author = current.createdByUsername ?? 'Gelöschtes Konto'

  // Named only when somebody other than the author wrote it, as a post's row does it:
  // "bearbeitet von federkiel" beside "federkiel" is noise.
  const lastEditor = current.updatedByUsername
  const byAnother = lastEditor !== null && lastEditor !== current.createdByUsername
  const changed =
    current.lastActivityAt === current.createdAt
      ? undefined
      : `bearbeitet ${formatActivityTime(current.lastActivityAt)}${byAnother ? ` von ${lastEditor}` : ''}`

  return [author, formatActivityTime(current.createdAt), changed]
    .filter((part) => part !== undefined)
    .join(' · ')
})

// Navigating from one page to another in the rail must not carry an open editor with it.
watch(pageId, () => {
  editing.value = false
  saveError.value = undefined
})
</script>

<template>
  <GroupHeader
    v-if="group"
    :title="group.title"
    :visibility="group.visibility"
    :subtitle="group.subtitle"
    :group-id="groupId"
  />

  <div class="flex-1 overflow-auto px-gutter pt-7 pb-8 md:px-10">
    <div class="reading-column">
      <p v-if="isPending" class="text-body text-ink-4">Die Seite wird geladen …</p>

      <p v-else-if="isError || page === undefined" class="text-body text-ink-4">
        Diese Seite gibt es nicht mehr.
      </p>

      <template v-else>
        <div class="mb-7">
          <PathToHere
            v-if="group"
            :tree="tree"
            :root-title="group.title"
            :root-to="{ name: 'group', params: { groupId } }"
            :folder-id="page.folderId"
          />

          <Input
            v-if="editing"
            v-model="draftTitle"
            class="mb-[5px]"
            name="pageTitle"
            :maxlength="LIMIT.title.maxLength"
            aria-label="Titel der Seite"
          />
          <h2 v-else class="mb-[5px] text-h2 text-ink-1">{{ page.title }}</h2>

          <div class="text-[12.5px] leading-[1.3] text-ink-5">{{ meta }}</div>
        </div>

        <PostEditor
          v-if="editing"
          ref="editor"
          v-model:document="draftDocument"
          v-model:text="draftText"
          :disabled="isSaving"
          framed
        />

        <PostBody v-else :document="page.document" />

        <Alert v-if="saveError" variant="destructive" role="alert" class="mt-3.5">
          <AlertDescription>{{ saveError }}</AlertDescription>
        </Alert>

        <div v-if="!editing" class="mt-3.5 flex items-center gap-2">
          <FavouriteToggle
            target-type="writing_page"
            :target-id="page.id"
            :is-favourite="page.isFavourite"
            @changed="refreshPage"
          />

          <!-- Outside the group of changing actions, as a thread's is: reporting is what
               somebody who may *not* change it does. -->
          <Button v-if="mayReport" variant="outline" size="sm" @click="reportingPage = true">
            <Flag :stroke-width="1.5" aria-hidden="true" />
            Melden
          </Button>
        </div>

        <!-- Any writer, not only the author: a page is material the group keeps, so changing
             it is the same permission as making one — see `mayAct`'s table in the backend. -->
        <div v-if="mayWrite" class="mt-3.5 flex items-center gap-4 text-[12px] text-ink-5">
          <template v-if="editing">
            <button
              type="button"
              class="flex min-h-11 items-center font-medium text-oak-deep disabled:opacity-50 md:min-h-0"
              :disabled="isSaving || draftTitle.trim().length === 0"
              @click="save"
            >
              {{ isSaving ? 'Wird gespeichert …' : 'Speichern' }}
            </button>
            <button
              type="button"
              class="flex min-h-11 items-center hover:text-ink-2 disabled:opacity-50 md:min-h-0"
              :disabled="isSaving"
              @click="editing = false"
            >
              Abbrechen
            </button>
          </template>

          <template v-else>
            <Button variant="outline" size="sm" @click="startEditing">
              <Pencil :stroke-width="1.5" />
              Seite bearbeiten
            </Button>
            <button
              type="button"
              class="flex min-h-11 items-center gap-1 hover:text-ink-2 md:min-h-0"
              @click="deleting = true"
            >
              <Trash2 :size="14" :stroke-width="1.5" />
              Löschen
            </button>
          </template>
        </div>
      </template>
    </div>
  </div>

  <ReportDialog
    v-if="page"
    v-model:open="reportingPage"
    target-type="writing_page"
    :target-id="page.id"
    :subject="page.title"
  />

  <DeletePageDialog
    v-if="page"
    v-model:open="deleting"
    :title="page.title"
    :pending="isDeleting"
    :error="deleteError"
    @confirmed="confirmDelete"
  />
</template>
