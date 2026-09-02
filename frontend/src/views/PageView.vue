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
import { Pencil, Trash2 } from '@lucide/vue'
import { ApiError } from '@/lib/api/apiFetch'
import { failureMessage } from '@/lib/format/failure'
import { firstMessage, proseSchema, titleSchema } from '@/lib/validation/fieldSchemas'
import { formatActivityTime } from '@/lib/format/formatTime'
import { formatCount } from '@/lib/format/formatNumber'
import { useGetGroup } from '@/api/groups/groups'
import { useGetCurrentUser } from '@/api/auth/auth'
import {
  getGetPageQueryKey,
  getListPagesQueryKey,
  useDeletePage,
  useGetPage,
  useUpdatePage,
} from '@/api/pages/pages'
import { useListMemberships } from '@/api/memberships/memberships'
import { TEXT_LIMIT } from '@/api/textLimit'
import type {
  GetGroup200,
  GetPage200,
  ListMemberships200ResultsItem,
  PostDocument,
} from '@/api/models'
import AppLayout from '@/components/layout/AppLayout.vue'
import GroupHeader from '@/components/group/GroupHeader.vue'
import PostBody from '@/components/thread/PostBody.vue'
import PostEditor from '@/components/thread/PostEditor.vue'
import DeletePageDialog from '@/components/page/DeletePageDialog.vue'
import StepList from '@/components/context/StepList.vue'
import StoryStatus from '@/components/context/StoryStatus.vue'
import RailBlock from '@/components/context/RailBlock.vue'
import StoryDetails from '@/components/context/StoryDetails.vue'
import FileList from '@/components/context/FileList.vue'
import MemberList from '@/components/context/MemberList.vue'
import PageList from '@/components/context/PageList.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()

const groupId = computed<string>(() => String(route.params.groupId))
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

const { data: groupData } = useGetGroup(groupId)
const group = computed<GetGroup200 | undefined>(() =>
  groupData.value?.status === 200 ? groupData.value.data : undefined,
)

const { data: pageData, isPending, isError } = useGetPage(groupId, pageId)
const page = computed<GetPage200 | undefined>(() =>
  pageData.value?.status === 200 ? pageData.value.data : undefined,
)

const { data: membershipsData } = useListMemberships(groupId)
const memberships = computed<ListMemberships200ResultsItem[]>(() =>
  membershipsData.value?.status === 200 ? membershipsData.value.data.results : [],
)

const mayWrite = computed<boolean>(
  () =>
    group.value?.status === 'joined' &&
    (group.value.role === 'writer' || group.value.role === 'administrator'),
)

const mayAdminister = computed<boolean>(
  () => group.value?.status === 'joined' && group.value.role === 'administrator',
)

/** The API's own rule, so the view never offers what the endpoint would refuse. */
const mayModify = computed<boolean>(
  () =>
    mayAdminister.value ||
    (page.value?.createdBy !== null && page.value?.createdBy === currentUserId.value),
)

const editing = ref<boolean>(false)
const draftTitle = ref<string>('')
const draftDocument = ref<PostDocument>({ type: 'doc', content: [{ type: 'paragraph' }] })
const draftText = ref<string>('')
const saveError = ref<string | undefined>(undefined)

const editor = useTemplateRef<{ focus: () => void }>('editor')

/**
 * What the save is conditional on: the `updatedAt` of the version being edited, kept as it was
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
  loadedAt.value = current.updatedAt
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
    queryClient.invalidateQueries({ queryKey: getListPagesQueryKey(groupId.value) }),
  ])
  editing.value = false
}

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

  await queryClient.invalidateQueries({ queryKey: getListPagesQueryKey(groupId.value) })
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
    current.updatedAt === current.createdAt
      ? undefined
      : `bearbeitet ${formatActivityTime(current.updatedAt)}${byAnother ? ` von ${lastEditor}` : ''}`

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
  <AppLayout :active-group-id="groupId">
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

          <div v-if="mayModify" class="mt-3.5 flex items-center gap-4 text-[12px] text-ink-5">
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

    <template #rail="{ collapsible }">
      <RailBlock label="Nächste Schritte" :collapsible="collapsible">
        <StepList :group-id="groupId" :may-write="mayWrite" :may-administer="mayAdminister" />
      </RailBlock>
      <RailBlock label="Story-Status" :collapsible="collapsible">
        <StoryStatus v-if="group" :group="group" :may-edit="mayAdminister" />
      </RailBlock>
    </template>

    <template #infoRail="{ collapsible }">
      <RailBlock label="Die Geschichte" :collapsible="collapsible">
        <StoryDetails v-if="group" :group="group" />
      </RailBlock>
      <RailBlock label="Seiten" :collapsible="collapsible">
        <PageList :group-id="groupId" :may-write="mayWrite" />
      </RailBlock>
      <RailBlock label="Dateien & Bilder" :collapsible="collapsible">
        <FileList />
      </RailBlock>
      <RailBlock label="Mitglieder" :collapsible="collapsible">
        <MemberList :memberships="memberships" />
      </RailBlock>
    </template>
  </AppLayout>

  <DeletePageDialog
    v-if="page"
    v-model:open="deleting"
    :title="page.title"
    :pending="isDeleting"
    :error="deleteError"
    @confirmed="confirmDelete"
  />
</template>
