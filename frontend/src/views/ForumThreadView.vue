<script setup lang="ts">
/**
 * One thread of the forum, its posts, and the composer for another — the group's paged endpoint
 * and the same `useDraft`, because a forum post *is* a `writing_post`.
 *
 * What differs is who may write: a group asks the member's role, this asks the thread.
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { keepPreviousData, useQueryClient } from '@tanstack/vue-query'
import { exactKeyFilter, listKeyPrefix } from '@/lib/api/queryKeys'
import {
  createForumPost as createForumPostRequest,
  deleteForumPost as deleteForumPostRequest,
  getGetForumThreadQueryKey,
  getListForumPostsQueryKey,
  getListForumThreadsQueryKey,
  listForumPosts as listForumPostsRequest,
  updateForumPost as updateForumPostRequest,
  useCreateForumPost,
  useDeleteForumPost,
  useGetForumThread,
  useListForumPosts,
  useUpdateForumPost,
} from '@/api/forum/forum'
import type { GetForumThread200, ListForumPosts200ResultsItem, PostDocument } from '@/api/models'
import { Flag, ShieldCheck } from '@lucide/vue'
import { useForumTree } from '@/composables/useForumTree'
import { useIsOperator } from '@/composables/useIsOperator'
import { mayWriteInForum } from '@/lib/forum/permission'
import { usePagedList } from '@/composables/usePagedList'
import PathToHere from '@/components/folder/PathToHere.vue'
import PostItem from '@/components/thread/PostItem.vue'
import ReportDialog from '@/components/report/ReportDialog.vue'
import ForumPermissionDialog from '@/components/forum/ForumPermissionDialog.vue'
import ListPagination from '@/components/common/ListPagination.vue'
import FavouriteToggle from '@/components/favourite/FavouriteToggle.vue'
import { pluralize } from '@/lib/format/formatText'
import { emptyDocument } from '@/lib/document/emptyDocument'
import { failureMessage } from '@/lib/format/failure'
import { firstMessage, postSchema } from '@/lib/validation/fieldSchemas'
import { useDraft } from '@/composables/useDraft'
import PostComposer from '@/components/thread/PostComposer.vue'
import DeletePostDialog from '@/components/thread/DeletePostDialog.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TEXT_LIMIT } from '@/api/textLimit'
import { useGetCurrentUser } from '@/api/auth/auth'

const POSTS_PER_PAGE = 20

const route = useRoute()
const threadId = computed<string>(() => String(route.params.threadId))

const queryClient = useQueryClient()

const { data: threadData, isPending, isError } = useGetForumThread(threadId)
const thread = computed<GetForumThread200 | undefined>(() =>
  threadData.value?.status === 200 ? threadData.value.data : undefined,
)

const { tree } = useForumTree()

const isOperator = useIsOperator()

const { data: userData } = useGetCurrentUser()
/** Absent until the session answers; `PostItem` hides „Melden" without it, and your own post. */
const currentUserId = computed<string | undefined>(() =>
  userData.value?.status === 200 ? userData.value.data.id : undefined,
)

/** A member's action rather than moderation, so it waits for neither #62 nor slice 7. */
const reportedPost = ref<ListForumPosts200ResultsItem | undefined>(undefined)
const reportingPost = computed<boolean>({
  get: () => reportedPost.value !== undefined,
  set: (open) => {
    if (!open) {
      reportedPost.value = undefined
    }
  },
})
const reportingThread = ref<boolean>(false)

/** An operator setting what members may do with this thread (#32's slice 7). */
const settingPermission = ref<boolean>(false)

/** Reporting your own thread is not a thing, the rule `PostItem` applies to a post. */
const mayReportThread = computed<boolean>(
  () =>
    currentUserId.value !== undefined &&
    thread.value !== undefined &&
    thread.value.createdBy !== currentUserId.value,
)

// Declared before the query it pages: the request body needs `offset` while vue-query builds
// the key, and the total it corrects against comes back from that same query.
const { page, offset, total, itemsPerPage, goToPage } = usePagedList(
  POSTS_PER_PAGE,
  () => postCount.value,
)

const postsQuery = computed(() => ({
  limit: POSTS_PER_PAGE,
  offset: offset.value,
  sortAttribute: 'createdAt' as const,
  // Oldest first: a thread reads in the order it was written.
  sortOrder: 'asc' as const,
}))

const { data: postsData } = useListForumPosts(threadId, postsQuery, {
  // Without this the strip vanishes between pages: a new page is a new query key, so the count
  // it is built from is briefly unknown.
  query: { placeholderData: keepPreviousData },
})

const posts = computed<ListForumPosts200ResultsItem[]>(() =>
  postsData.value?.status === 200 ? postsData.value.data.results : [],
)
const postCount = computed<number | undefined>(() =>
  postsData.value?.status === 200 ? postsData.value.data.totalResults : undefined,
)

const meta = computed<string>(() => {
  const count = postCount.value
  return count === undefined ? '' : pluralize(count, 'Beitrag', 'Beiträge')
})

/** The limits come from this operation's own entry, never another's. */
const NEW_POST = postSchema(TEXT_LIMIT.createForumPost.document)

/**
 * Only where the thread grants `write`, which is the forum's „locked". The API refuses either way;
 * this keeps the box off a page that cannot use it.
 */
const mayWrite = computed<boolean>(() =>
  mayWriteInForum(thread.value?.effectiveMemberPermission, isOperator.value),
)

const draft = ref<PostDocument>(emptyDocument())
const draftText = ref<string>('')
const sendError = ref<string | undefined>(undefined)

const {
  status: draftStatus,
  draftId,
  forget: forgetDraft,
} = useDraft(
  threadId,
  {
    load: async () => {
      const response = await listForumPostsRequest(threadId.value, {
        isDraft: true,
        limit: 1,
      })
      return response.status === 200 ? response.data.results[0] : undefined
    },
    create: async (document) => {
      const created = await createForumPostRequest(threadId.value, {
        document,
        isDraft: true,
      })
      return created.status === 201 ? created.data.id : undefined
    },
    update: (postId, document, options) =>
      updateForumPostRequest(threadId.value, postId, { document }, options),
    remove: (postId) => deleteForumPostRequest(threadId.value, postId),
  },
  draft,
  draftText,
)

const { mutateAsync: createReply, isPending: sending } = useCreateForumPost()
const { mutateAsync: publishDraft, isPending: publishing } = useUpdateForumPost()

async function submit() {
  sendError.value = undefined
  if (draftText.value.trim().length === 0) {
    return
  }

  // Checked here rather than with `maxlength` on the composer: prose stopping dead mid-word with
  // no explanation is worse than being told why, and the draft is kept either way.
  sendError.value = firstMessage(NEW_POST.safeParse(draftText.value))
  if (sendError.value !== undefined) {
    return
  }

  try {
    // Publishing clears the draft's flag rather than writing a second post: the autosaved row
    // and the published one have to be the same row.
    if (draftId.value !== undefined) {
      await publishDraft({
        threadId: threadId.value,
        postId: draftId.value,
        data: { document: draft.value, isDraft: false },
      })
      forgetDraft()
    } else {
      await createReply({ threadId: threadId.value, data: { document: draft.value } })
    }
  } catch (error) {
    // The draft is kept either way, which is what the clearing below guarantees.
    sendError.value = failureMessage(
      error,
      'Der Beitrag konnte nicht gesendet werden. Versuche es noch einmal.',
    )
    return
  }

  // Only cleared once the post is really stored, so nothing written is lost.
  draft.value = emptyDocument()
  draftText.value = ''

  // Every page, not the one on screen: a new post changes the count, and with it which page
  // anything sits on.
  await queryClient.invalidateQueries({
    queryKey: listKeyPrefix(getListForumPostsQueryKey(threadId.value)),
  })

  // Land where the new post is — a thread reads oldest first, so that is the last page.
  goToPage(Math.ceil(((postCount.value ?? 0) + 1) / POSTS_PER_PAGE))
}

const EDITED_POST = postSchema(TEXT_LIMIT.updateForumPost.document, 'Ein Beitrag braucht Text.')

/** The thread decides which post is open, so two cannot be edited at once. */
const editingPostId = ref<string | undefined>(undefined)
const editError = ref<string | undefined>(undefined)

const { mutateAsync: saveReply, isPending: savingReply } = useUpdateForumPost()

function startEditing(postId: string) {
  editError.value = undefined
  editingPostId.value = postId
}

function stopEditing() {
  editError.value = undefined
  editingPostId.value = undefined
}

async function refreshReplies(): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: listKeyPrefix(getListForumPostsQueryKey(threadId.value)),
  })
}

async function saveEdit(postId: string, document: PostDocument, text: string) {
  editError.value = firstMessage(EDITED_POST.safeParse(text))
  if (editError.value !== undefined) {
    return
  }

  try {
    await saveReply({ threadId: threadId.value, postId, data: { document } })
  } catch (error) {
    editError.value = failureMessage(
      error,
      'Der Beitrag konnte nicht gespeichert werden. Versuche es noch einmal.',
    )
    return
  }

  await refreshReplies()
  stopEditing()
}

const deletingPost = ref<ListForumPosts200ResultsItem | undefined>(undefined)
const deletePostError = ref<string | undefined>(undefined)
const { mutateAsync: removeReply, isPending: removingReply } = useDeleteForumPost()

const deletingPostOpen = computed<boolean>({
  get: () => deletingPost.value !== undefined,
  set: (open) => {
    if (!open) deletingPost.value = undefined
  },
})

/** Named only when it is somebody else's, which is the case worth a second look. */
const deletingPostAuthor = computed<string | undefined>(() =>
  deletingPost.value !== undefined && deletingPost.value.createdBy !== currentUserId.value
    ? (deletingPost.value.createdByUsername ?? undefined)
    : undefined,
)

async function confirmDeletePost() {
  const post = deletingPost.value
  if (post === undefined) return

  deletePostError.value = undefined
  try {
    await removeReply({ threadId: threadId.value, postId: post.id })
  } catch (error) {
    deletePostError.value = failureMessage(
      error,
      'Der Beitrag konnte nicht gelöscht werden. Versuche es noch einmal.',
    )
    return
  }

  // The post being edited may be the one just deleted.
  if (editingPostId.value === post.id) stopEditing()
  await refreshReplies()
  deletingPost.value = undefined
}

/**
 * The list as well as the thread: the rail draws its favourite mark from the list. Exact-keyed,
 * because a GET list's key is a prefix of every item under it.
 */
async function refresh(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: getGetForumThreadQueryKey(threadId) })
  await queryClient.invalidateQueries(exactKeyFilter(getListForumThreadsQueryKey()))
}
</script>

<template>
  <div class="flex-1 overflow-auto px-gutter pt-7 pb-8 md:px-10">
    <div class="reading-column">
      <p v-if="isPending" class="text-body text-ink-4">Das Thema wird geladen …</p>

      <p v-else-if="isError || thread === undefined" class="text-body text-ink-4">
        Dieses Thema gibt es nicht.
      </p>

      <template v-else>
        <div class="mb-7">
          <PathToHere
            :tree="tree"
            root-title="Forum"
            :root-to="{ name: 'forum' }"
            :folder-id="thread.folderId"
          />

          <h2 class="mb-[5px] text-h2 text-ink-1">{{ thread.title }}</h2>
          <div class="text-[12.5px] leading-[1.3] text-ink-5">{{ meta }}</div>

          <div class="mt-3.5 flex items-center gap-2 text-note text-ink-4">
            <FavouriteToggle
              target-type="writing_thread"
              :target-id="thread.id"
              :is-favourite="thread.isFavourite"
              @changed="refresh"
            />

            <!-- A raw button, as a post's own „Melden" is: these are text actions sharing a
                 baseline rather than buttons, so they carry the 44px rule themselves. -->
            <button
              v-if="mayReportThread"
              type="button"
              class="flex min-h-11 items-center gap-1.5 hover:text-oak-deep md:min-h-0"
              @click="reportingThread = true"
            >
              <Flag :size="14" :stroke-width="1.5" aria-hidden="true" />
              Melden
            </button>

            <!-- An operator's act and only theirs: what members may do here is nobody else's to
                 set, since the forum has no administrators. -->
            <button
              v-if="isOperator"
              type="button"
              class="flex min-h-11 items-center gap-1.5 hover:text-oak-deep md:min-h-0"
              @click="settingPermission = true"
            >
              <ShieldCheck :size="14" :stroke-width="1.5" aria-hidden="true" />
              Rechte
            </button>
          </div>
        </div>

        <p v-if="posts.length === 0" class="text-body text-ink-4">Hier steht noch nichts.</p>

        <PostItem
          v-for="(post, index) in posts"
          :key="post.id"
          :post="post"
          :divider="index > 0"
          :first="index === 0"
          :current-user-id="currentUserId"
          :may-write="mayWrite"
          :editing="editingPostId === post.id"
          :saving="savingReply"
          :error="editingPostId === post.id ? editError : undefined"
          @report="reportedPost = post"
          @edit="startEditing(post.id)"
          @cancel="stopEditing"
          @save="(document, text) => saveEdit(post.id, document, text)"
          @delete="deletingPost = post"
        />

        <ListPagination
          v-if="posts.length > 0"
          v-model:page="page"
          :total="total"
          :items-per-page="itemsPerPage"
          class="mt-7"
        />

        <Alert v-if="sendError" variant="destructive" role="alert" class="mt-3.5">
          <AlertDescription>{{ sendError }}</AlertDescription>
        </Alert>
      </template>
    </div>
  </div>

  <PostComposer
    v-if="mayWrite"
    v-model="draft"
    v-model:text="draftText"
    :sending="sending || publishing"
    :draft-status="draftStatus"
    @submit="submit"
  />

  <DeletePostDialog
    v-if="deletingPost"
    v-model:open="deletingPostOpen"
    :author-name="deletingPostAuthor"
    :pending="removingReply"
    :error="deletePostError"
    @confirmed="confirmDeletePost"
  />

  <ReportDialog
    v-if="reportedPost"
    v-model:open="reportingPost"
    target-type="writing_post"
    :target-id="reportedPost.id"
    :subject="reportedPost.createdByUsername ?? 'Gelöschtes Konto'"
  />

  <ReportDialog
    v-if="thread"
    v-model:open="reportingThread"
    target-type="writing_thread"
    :target-id="thread.id"
    :subject="thread.title"
  />

  <!-- `v-if` as its neighbours have it: a shut dialog keeps its content otherwise, and this one
       opens on a stored value that would then be the previous thread's. -->
  <ForumPermissionDialog
    v-if="thread"
    v-model:open="settingPermission"
    target-type="thread"
    :target-id="thread.id"
    :member-permission="thread.memberPermission"
    :title="thread.title"
    @changed="refresh"
  />
</template>
