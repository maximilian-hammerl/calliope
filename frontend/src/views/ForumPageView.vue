<script setup lang="ts">
/**
 * One page of the forum — an announcement, the rules, an FAQ — and its editor.
 *
 * A page is written together rather than owned, so the editor follows the page's permission
 * rather than its author. The stale-write check is the group's, for the same reason.
 */
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useRoute } from 'vue-router'
import { Flag, Pencil, ShieldCheck } from '@lucide/vue'
import { useQueryClient } from '@tanstack/vue-query'
import { exactKeyFilter } from '@/lib/api/queryKeys'
import {
  getGetForumPageQueryKey,
  getListForumPagesQueryKey,
  useGetForumPage,
  useUpdateForumPage,
} from '@/api/forum/forum'
import type { GetForumPage200, PostDocument } from '@/api/models'
import { useForumTree } from '@/composables/useForumTree'
import { useIsOperator } from '@/composables/useIsOperator'
import { mayWriteInForum } from '@/lib/forum/permission'
import PathToHere from '@/components/folder/PathToHere.vue'
import PostBody from '@/components/thread/PostBody.vue'
import FavouriteToggle from '@/components/favourite/FavouriteToggle.vue'
import ReportDialog from '@/components/report/ReportDialog.vue'
import ForumPermissionDialog from '@/components/forum/ForumPermissionDialog.vue'
import { useGetCurrentUser } from '@/api/auth/auth'
import { formatActivityTime } from '@/lib/format/formatTime'
import { formatCount } from '@/lib/format/formatNumber'
import { failureMessage } from '@/lib/format/failure'
import { firstMessage, proseSchema, titleSchema } from '@/lib/validation/fieldSchemas'
import { ApiError } from '@/lib/api/apiFetch'
import { TEXT_LIMIT } from '@/api/textLimit'
import PostEditor from '@/components/thread/PostEditor.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const route = useRoute()
const pageId = computed<string>(() => String(route.params.pageId))

const queryClient = useQueryClient()

const { data, isPending, isError } = useGetForumPage(pageId)
const page = computed<GetForumPage200 | undefined>(() =>
  data.value?.status === 200 ? data.value.data : undefined,
)

const { tree } = useForumTree()

const isOperator = useIsOperator()

const { data: userData } = useGetCurrentUser()
const currentUserId = computed<string | undefined>(() =>
  userData.value?.status === 200 ? userData.value.data.id : undefined,
)

/**
 * Usually an operator's announcement, so this is a member reporting the operators. Here anyway:
 * once members write pages themselves it stops being the unusual case.
 */
const LIMIT = TEXT_LIMIT.updateForumPage

const TITLE = titleSchema(LIMIT.title, 'Gib der Seite einen Titel.')

// No minimum: a page named and left empty for now is a stub, which the API allows.
const PAGE_TEXT = proseSchema(
  LIMIT.document,
  `Die Seite ist zu lang. Sie darf höchstens ${formatCount(LIMIT.document.maxLength)} Zeichen haben.`,
)

/** Written together, so this asks the page rather than who wrote it. An operator always may. */
const mayWrite = computed<boolean>(() =>
  mayWriteInForum(page.value?.effectiveMemberPermission, isOperator.value),
)

const editing = ref<boolean>(false)
const draftTitle = ref<string>('')
const draftDocument = ref<PostDocument>({ type: 'doc', content: [{ type: 'paragraph' }] })
const draftText = ref<string>('')
const saveError = ref<string | undefined>(undefined)

const editor = useTemplateRef<{ focus: () => void }>('editor')

/** Kept exactly as received: parsing it into a date would drop the microseconds the API compares. */
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

const { mutateAsync: savePage, isPending: isSaving } = useUpdateForumPage()

async function save() {
  const at = loadedAt.value
  if (at === undefined) return

  saveError.value =
    firstMessage(TITLE.safeParse(draftTitle.value)) ??
    firstMessage(PAGE_TEXT.safeParse(draftText.value))
  if (saveError.value !== undefined) return

  try {
    await savePage({
      pageId: pageId.value,
      data: { title: draftTitle.value.trim(), document: draftDocument.value, loadedAt: at },
    })
  } catch (error) {
    // The one refusal worth its own sentence: somebody else's version is the stored one now, and
    // what this member typed is still in front of them.
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

  await refresh()
  editing.value = false
}

const reportingPage = ref<boolean>(false)
const mayReport = computed<boolean>(
  () =>
    currentUserId.value !== undefined &&
    page.value !== undefined &&
    page.value.createdBy !== currentUserId.value,
)

/** An operator's act, separate from „Seite bearbeiten", which is any writer's. */
const settingPermission = ref<boolean>(false)

const meta = computed<string>(() => {
  const current = page.value
  if (current === undefined) return ''
  const author = current.createdByUsername ?? 'Unbekannt'
  return `Von ${author} · ${formatActivityTime(current.lastActivityAt)}`
})

/** The list as well as the page: the rail's favourite mark is drawn from the list. */
async function refresh(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: getGetForumPageQueryKey(pageId) })
  await queryClient.invalidateQueries(exactKeyFilter(getListForumPagesQueryKey()))
}
</script>

<template>
  <div class="flex-1 overflow-auto px-gutter pt-7 pb-8 md:px-10">
    <div class="reading-column">
      <p v-if="isPending" class="text-body text-ink-4">Die Seite wird geladen …</p>

      <p v-else-if="isError || page === undefined" class="text-body text-ink-4">
        Diese Seite gibt es nicht.
      </p>

      <template v-else>
        <div class="mb-7">
          <PathToHere
            :tree="tree"
            root-title="Forum"
            :root-to="{ name: 'forum' }"
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

        <div v-if="editing" class="mt-3.5 flex items-center gap-2">
          <Button size="sm" :disabled="isSaving" @click="save">Speichern</Button>
          <Button size="sm" variant="outline" :disabled="isSaving" @click="editing = false">
            Abbrechen
          </Button>
        </div>

        <div v-else class="mt-3.5 flex items-center gap-2 text-note text-ink-4">
          <FavouriteToggle
            target-type="writing_page"
            :target-id="page.id"
            :is-favourite="page.isFavourite"
            @changed="refresh"
          />

          <button
            v-if="mayReport"
            type="button"
            class="flex min-h-11 items-center gap-1.5 hover:text-oak-deep md:min-h-0"
            @click="reportingPage = true"
          >
            <Flag :size="14" :stroke-width="1.5" aria-hidden="true" />
            Melden
          </button>

          <!-- Beside „Melden" rather than inside the editor: that is gated on `mayWrite`, and
               this is an operator's alone. -->
          <button
            v-if="isOperator"
            type="button"
            class="flex min-h-11 items-center gap-1.5 hover:text-oak-deep md:min-h-0"
            @click="settingPermission = true"
          >
            <ShieldCheck :size="14" :stroke-width="1.5" aria-hidden="true" />
            Rechte
          </button>

          <button
            v-if="mayWrite"
            type="button"
            class="flex min-h-11 items-center gap-1.5 hover:text-oak-deep md:min-h-0"
            @click="startEditing"
          >
            <Pencil :size="14" :stroke-width="1.5" aria-hidden="true" />
            Seite bearbeiten
          </button>
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

  <ForumPermissionDialog
    v-if="page"
    v-model:open="settingPermission"
    target-type="page"
    :target-id="page.id"
    :member-permission="page.memberPermission"
    :title="page.title"
    @changed="refresh"
  />
</template>
