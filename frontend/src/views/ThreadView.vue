<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { keepPreviousData, useQueryClient } from '@tanstack/vue-query'
import { failureMessage } from '@/lib/format/failure'
import { firstMessage, postSchema } from '@/lib/validation/fieldSchemas'
import { useGetGroup } from '@/api/groups/groups'
import { useGetCurrentUser } from '@/api/auth/auth'
import {
  getGetThreadQueryKey,
  getListThreadsQueryKey,
  useDeleteThread,
  useGetThread,
  useListThreads,
} from '@/api/threads/threads'
import {
  getListPostsQueryKey,
  useCreatePost,
  useDeletePost,
  useListPosts,
  useUpdatePost,
} from '@/api/posts/posts'
import { useListMemberships } from '@/api/memberships/memberships'
import type {
  GetGroup200,
  GetThread200,
  ListMemberships200ResultsItem,
  ListPosts200ResultsItem,
  ListThreads200ResultsItem,
  PostDocument,
} from '@/api/models'
import AppLayout from '@/components/layout/AppLayout.vue'
import GroupHeader from '@/components/group/GroupHeader.vue'
import ThreadTabs from '@/components/thread/ThreadTabs.vue'
import DeleteThreadDialog from '@/components/thread/DeleteThreadDialog.vue'
import ThreadDialog from '@/components/thread/ThreadDialog.vue'
import ThreadHeader from '@/components/thread/ThreadHeader.vue'
import ReportDialog from '@/components/report/ReportDialog.vue'
import DeletePostDialog from '@/components/thread/DeletePostDialog.vue'
import PostItem from '@/components/thread/PostItem.vue'
import ListPagination from '@/components/common/ListPagination.vue'
import PostSortToggle from '@/components/thread/PostSortToggle.vue'
import { TEXT_LIMIT } from '@/api/textLimit'
import { emptyDocument } from '@/lib/document/emptyDocument'
import { listKeyPrefix } from '@/lib/api/queryKeys'
import { FAVOURITE_FILTER_LABELS } from '@/lib/format/favourite'
import FilterStrip from '@/components/common/FilterStrip.vue'
import { useDraft } from '@/composables/useDraft'
import { useSteps } from '@/composables/useSteps'
import { usePagedList } from '@/composables/usePagedList'
import PostComposer from '@/components/thread/PostComposer.vue'
import StepList from '@/components/context/StepList.vue'
import StoryStatus from '@/components/context/StoryStatus.vue'
import RailBlock from '@/components/context/RailBlock.vue'
import StoryDetails from '@/components/context/StoryDetails.vue'
import FileList from '@/components/context/FileList.vue'
import PageList from '@/components/context/PageList.vue'
import MemberList from '@/components/context/MemberList.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()

const { data: currentUserData } = useGetCurrentUser()
const currentUserId = computed<string | undefined>(() =>
  currentUserData.value?.status === 200 ? currentUserData.value.data.id : undefined,
)

const groupId = computed<string>(() => String(route.params.groupId))

/** A thread created from inside another one is still what the member asked to open. */
function openThread(newThreadId: string) {
  void router.push({ name: 'thread', params: { groupId: groupId.value, threadId: newThreadId } })
}
const threadId = computed<string>(() => String(route.params.threadId))

const { data: groupData } = useGetGroup(groupId)
const group = computed<GetGroup200 | undefined>(() =>
  groupData.value?.status === 200 ? groupData.value.data : undefined,
)

const { data: threadData, isPending, isError } = useGetThread(groupId, threadId)

/**
 * The thread's own query and the strip it sits in — the strip orders favourites first, so it has
 * to be refetched or the tab stays where it was.
 */
/** The page of posts this one is on, which carries the flag the row draws. */
async function refreshPosts() {
  await queryClient.invalidateQueries({
    queryKey: listKeyPrefix(getListPostsQueryKey(groupId.value, threadId.value)),
  })
}

async function refreshThread() {
  await queryClient.invalidateQueries({
    queryKey: getGetThreadQueryKey(groupId.value, threadId.value),
  })
  await queryClient.invalidateQueries({ queryKey: getListThreadsQueryKey(groupId.value) })
}
const thread = computed<GetThread200 | undefined>(() =>
  threadData.value?.status === 200 ? threadData.value.data : undefined,
)

const { data: threadsData } = useListThreads(groupId)
const threads = computed<ListThreads200ResultsItem[]>(() =>
  threadsData.value?.status === 200 ? threadsData.value.data.results : [],
)

/**
 * Twenty is the endpoint's own default, and a page of prose that size stays scannable — the
 * number of pages is what makes a known post quick to reach.
 */
const POSTS_PER_PAGE = 20

/**
 * Page and order live in the URL, which is what makes jumping durable: a reload, the back
 * button and a second tab opened on the passage being referenced all keep their place.
 * Route keys are English like every other path; only what the member reads is German.
 */
/** Which end of the thread to start at. The pages themselves are the composable's business. */
const order = computed<'oldest' | 'newest'>(() =>
  route.query.order === 'newest' ? 'newest' : 'oldest',
)

const postCount = computed<number | undefined>(() =>
  postsData.value?.status === 200 ? postsData.value.data.totalResults : undefined,
)

const { page, offset, total, itemsPerPage, pageCount, goToPage, navigate } = usePagedList(
  POSTS_PER_PAGE,
  () => postCount.value,
)

/** One push, not two: switching the order also returns to the first page. */
function showOrder(next: 'oldest' | 'newest') {
  navigate({ order: next === 'oldest' ? undefined : next, page: undefined })
}

/**
 * The post filter the design system specifies ("Alle Beiträge"), which was absent rather than
 * disabled while neither of its options existed. Favourites is the first of the two; annotations
 * (#38) are the other.
 *
 * A filter, never a reordering: a thread reads in the order it was written, so a favourited post
 * stays where it is and this narrows to them instead.
 */
const postFilter = ref<'any' | 'only'>('any')

const POST_FILTERS = [
  { value: 'any', label: 'Alle Beiträge' },
  { value: 'only', label: FAVOURITE_FILTER_LABELS.only },
] as const

// A filter is about a different set, so whatever page was open is about something else.
watch(postFilter, () => goToPage(1))

const postsQuery = computed(() => ({
  limit: POSTS_PER_PAGE,
  offset: offset.value,
  sortAttribute: 'createdAt' as const,
  sortOrder: order.value === 'newest' ? ('desc' as const) : ('asc' as const),
  favourite: postFilter.value,
}))

const { data: postsData } = useListPosts(groupId, threadId, postsQuery, {
  // Without this the strip vanishes between pages: a new page is a new query key, so the count
  // it is built from is briefly unknown.
  query: { placeholderData: keepPreviousData },
})
const posts = computed<ListPosts200ResultsItem[]>(() =>
  postsData.value?.status === 200 ? postsData.value.data.results : [],
)
const { data: membershipsData } = useListMemberships(groupId)
const memberships = computed<ListMemberships200ResultsItem[]>(() =>
  membershipsData.value?.status === 200 ? membershipsData.value.data.results : [],
)

// Served from the block's own query: the rail's label says how many are open while it is closed.
const { open: openSteps } = useSteps(groupId)

/**
 * The group reports the reader's own standing, so the role no longer has to be read out of
 * the member list. Only a joined membership carries it: an invitation may be looked at but
 * not written into.
 */
const mayWrite = computed<boolean>(
  () =>
    group.value?.status === 'joined' &&
    (group.value.role === 'writer' || group.value.role === 'administrator'),
)

/**
 * The rule `mayModify` gives content: an administrator of the group, or whoever started it.
 * The endpoint decides; this only keeps the controls off a page that cannot use them.
 */
const mayModifyThread = computed<boolean>(
  () =>
    mayAdminister.value ||
    (thread.value?.createdBy !== null && thread.value?.createdBy === currentUserId.value),
)

const reportingThread = ref<boolean>(false)
/** The post being reported, which is also what opens the dialog. */
const reportedPost = ref<ListPosts200ResultsItem | undefined>(undefined)
const reportingPost = computed<boolean>({
  get: () => reportedPost.value !== undefined,
  set: (open) => {
    if (!open) {
      reportedPost.value = undefined
    }
  },
})
const renamingThread = ref<boolean>(false)
const deletingThread = ref<boolean>(false)
const deletionError = ref<string | undefined>(undefined)

const { mutateAsync: deleteThread, isPending: isDeletingThread } = useDeleteThread()

async function confirmDeleteThread() {
  deletionError.value = undefined
  try {
    await deleteThread({ groupId: groupId.value, threadId: threadId.value })
  } catch (error) {
    deletionError.value = failureMessage(
      error,
      'Der Thread konnte nicht gelöscht werden. Versuche es noch einmal.',
    )
    return
  }

  await queryClient.invalidateQueries({ queryKey: getListThreadsQueryKey(groupId.value) })
  deletingThread.value = false
  // The thread this page is about no longer exists.
  void router.push({ name: 'group', params: { groupId: groupId.value } })
}

const mayAdminister = computed<boolean>(
  () => group.value?.status === 'joined' && group.value.role === 'administrator',
)

/** The composer holds a document; `draftText` is its prose, which the editor supplies. */
const draft = ref<PostDocument>(emptyDocument())
const draftText = ref<string>('')
const sendError = ref<string | undefined>(undefined)
function goToGroup() {
  void router.push({ name: 'group', params: { groupId: groupId.value } })
}

const creatingThread = ref<boolean>(false)

const { mutateAsync: createPost, isPending: sending } = useCreatePost()
const { mutateAsync: publishDraft, isPending: publishing } = useUpdatePost()

/**
 * A second instance of the same mutation, so editing a published post and publishing a draft
 * do not share one `isPending` — the composer and a post can be busy independently.
 */
const { mutateAsync: savePost, isPending: savingPost } = useUpdatePost()

// The two operations carry their own bounds; an empty edit is a mistake, an empty composer is
// just a composer nobody has typed in yet.
const NEW_POST = postSchema(TEXT_LIMIT.createPost.document)
const EDITED_POST = postSchema(TEXT_LIMIT.updatePost.document, 'Ein Beitrag braucht Text.')

const editingPostId = ref<string | undefined>(undefined)
const editError = ref<string | undefined>(undefined)

function startEditing(postId: string) {
  editError.value = undefined
  editingPostId.value = postId
}

function stopEditing() {
  editError.value = undefined
  editingPostId.value = undefined
}

async function saveEdit(postId: string, document: PostDocument, text: string) {
  editError.value = undefined

  // Checked here rather than with `maxlength`, for the reason the composer states: prose that
  // stops dead mid-word is worse than being told why.
  editError.value = firstMessage(EDITED_POST.safeParse(text))
  if (editError.value !== undefined) {
    return
  }

  try {
    await savePost({
      groupId: groupId.value,
      threadId: threadId.value,
      postId,
      data: { document },
    })
  } catch (error) {
    editError.value = failureMessage(
      error,
      'Der Beitrag konnte nicht gespeichert werden. Versuche es noch einmal.',
    )
    return
  }

  await queryClient.invalidateQueries({
    queryKey: listKeyPrefix(getListPostsQueryKey(groupId.value, threadId.value)),
  })
  stopEditing()
}

const deletingPost = ref<ListPosts200ResultsItem | undefined>(undefined)
const deletePostError = ref<string | undefined>(undefined)

const { mutateAsync: removePost, isPending: removingPost } = useDeletePost()

/** Named only when it is somebody else's and that account still exists. */
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
    await removePost({ groupId: groupId.value, threadId: threadId.value, postId: post.id })
  } catch (error) {
    deletePostError.value = failureMessage(
      error,
      'Der Beitrag konnte nicht gelöscht werden. Versuche es noch einmal.',
    )
    return
  }

  // The header's count is the list's own totalResults, so one invalidation covers both.
  // The post being edited may be the one just deleted.
  if (editingPostId.value === post.id) stopEditing()
  await queryClient.invalidateQueries({
    queryKey: listKeyPrefix(getListPostsQueryKey(groupId.value, threadId.value)),
  })
  deletingPost.value = undefined
}

// Owns the composer's text between visits: loads any existing draft into it, saves as it is
// written, and lets go of the row once it has been published.
const {
  status: draftStatus,
  draftId,
  forget: forgetDraft,
} = useDraft(groupId, threadId, draft, draftText)

async function submit() {
  sendError.value = undefined
  if (draftText.value.trim().length === 0) {
    return
  }

  // Checked here rather than with `maxlength` on the composer: prose stopping dead mid-word
  // with no explanation is worse than being told why, and the draft is kept either way.
  sendError.value = firstMessage(NEW_POST.safeParse(draftText.value))
  if (sendError.value !== undefined) {
    return
  }

  try {
    // Publishing an existing draft clears its flag rather than writing a second post — the
    // autosaved row and the published one have to be the same row.
    if (draftId.value !== undefined) {
      await publishDraft({
        groupId: groupId.value,
        threadId: threadId.value,
        postId: draftId.value,
        data: { document: draft.value, isDraft: false },
      })
      forgetDraft()
    } else {
      await createPost({
        groupId: groupId.value,
        threadId: threadId.value,
        data: { document: draft.value },
      })
    }
  } catch (error) {
    // The draft is kept either way, which is what the clearing below guarantees.
    sendError.value = failureMessage(
      error,
      'Der Beitrag konnte nicht gesendet werden. Versuche es noch einmal.',
    )
    return
  }

  // Only cleared once the post is really stored, so nothing a member wrote is lost.
  draft.value = emptyDocument()
  draftText.value = ''

  // Every page, not the one being shown: the new post changes the count, and with it which
  // page anything sits on. The exact key would also miss, since it carries this page's body.
  await queryClient.invalidateQueries({
    queryKey: listKeyPrefix(getListPostsQueryKey(groupId.value, threadId.value)),
  })

  // Land where the new post is. Reading page two for reference is worth interrupting to show
  // somebody their own writing; not showing it at all would be worse.
  goToPage(order.value === 'newest' ? 1 : Math.ceil(((postCount.value ?? 0) + 1) / POSTS_PER_PAGE))
}
</script>

<template>
  <AppLayout :active-group-id="groupId">
    <template v-if="thread">
      <GroupHeader
        v-if="group"
        :title="group.title"
        :visibility="group.visibility"
        :subtitle="group.subtitle"
        :group-id="groupId"
      />

      <ThreadTabs
        :group-id="groupId"
        :threads="threads"
        :active-id="threadId"
        :may-write="mayWrite"
        @create="creatingThread = true"
      />

      <div class="flex-1 overflow-auto px-gutter pt-7 pb-8 md:px-10">
        <div class="reading-column">
          <ThreadHeader
            :title="thread.title"
            :post-count="postCount"
            :last-activity-at="thread.lastActivityAt"
            :may-modify="mayModifyThread"
            :thread-id="thread.id"
            :is-favourite="thread.isFavourite"
            @rename="renamingThread = true"
            @delete="deletingThread = true"
            @report="reportingThread = true"
            @favourite-changed="refreshThread"
          />

          <!-- The filter the header's own comment has been waiting on. It sits under the header
               rather than in it, beside the order toggle and the page strip it belongs with. -->
          <FilterStrip v-model="postFilter" label="Beiträge" :options="POST_FILTERS" class="mb-5" />

          <p v-if="posts.length === 0" class="text-body text-ink-4">
            Noch keine Beiträge in „{{ thread.title }}“.
            <template v-if="mayWrite">Schreib den ersten.</template>
          </p>

          <!-- The order sits above the posts it orders. Only worth offering once there is
               more than one page to start at either end of. -->
          <div
            v-if="pageCount > 1"
            class="mb-5 flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line-2 pb-2"
          >
            <PostSortToggle :model-value="order" @update:model-value="showOrder($event)" />
            <span class="ml-auto text-[12.5px] text-ink-6"
              >Seite {{ page }} von {{ pageCount }}</span
            >
          </div>

          <PostItem
            v-for="(post, index) in posts"
            :key="post.id"
            :post="post"
            :first="index === 0"
            :divider="index < posts.length - 1"
            :current-user-id="currentUserId"
            :may-administer="mayAdminister"
            :editing="editingPostId === post.id"
            :saving="savingPost && editingPostId === post.id"
            :error="editingPostId === post.id ? editError : undefined"
            @report="reportedPost = post"
            @favourite-changed="refreshPosts"
            @edit="startEditing(post.id)"
            @cancel="stopEditing"
            @save="(document, text) => saveEdit(post.id, document, text)"
            @delete="deletingPost = post"
          />

          <!-- Below the posts as well as in the strip above: this is where somebody is when
               they finish a page, and where the composer already has them. -->
          <div v-if="pageCount > 1" class="mt-7 border-t border-line-2 pt-3">
            <ListPagination v-model:page="page" :total="total" :items-per-page="itemsPerPage" />
          </div>
        </div>
      </div>

      <!-- The alert brings its own padding, which would outrank the reading column's, so the
           column is a wrapper here rather than the alert itself. -->
      <div v-if="sendError" class="px-gutter pb-3 md:px-10">
        <div class="reading-column">
          <Alert variant="destructive" role="alert">
            <AlertDescription>{{ sendError }}</AlertDescription>
          </Alert>
        </div>
      </div>

      <!-- Readers may read and comment, so they get no composer. -->
      <PostComposer
        v-if="mayWrite"
        v-model="draft"
        v-model:text="draftText"
        :sending="sending || publishing"
        :draft-status="draftStatus"
        @submit="submit"
      />
    </template>

    <div v-else-if="isPending" class="px-gutter py-5 text-[12.5px] text-ink-5 md:px-10">
      <div class="reading-column">Thread wird geladen …</div>
    </div>

    <div v-else-if="isError" class="px-gutter py-5 md:px-10">
      <div class="reading-column">
        <p class="max-w-[46ch] text-body text-ink-4">
          Diesen Thread gibt es nicht, oder du gehörst nicht zu seiner Gruppe.
        </p>
        <Button variant="outline" size="sm" class="mt-5" @click="goToGroup"> Zur Gruppe </Button>
      </div>
    </div>

    <!-- What the member does. -->
    <template #rail="{ collapsible }">
      <RailBlock
        label="Nächste Schritte"
        :meta="`${openSteps.length} offen`"
        :collapsible="collapsible"
      >
        <StepList :group-id="groupId" :may-write="mayWrite" :may-administer="mayAdminister" />
      </RailBlock>
      <RailBlock label="Story-Status" :collapsible="collapsible">
        <StoryStatus v-if="group" :group="group" :may-edit="mayAdminister" />
      </RailBlock>
    </template>

    <!-- What the member looks up while writing. -->
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

  <ThreadDialog v-model:open="creatingThread" :group-id="groupId" @created="openThread" />

  <ThreadDialog v-if="thread" v-model:open="renamingThread" :group-id="groupId" :thread="thread" />

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

  <DeleteThreadDialog
    v-if="thread"
    v-model:open="deletingThread"
    :title="thread.title"
    :post-count="postCount"
    :pending="isDeletingThread"
    :error="deletionError"
    @confirmed="confirmDeleteThread"
  />

  <DeletePostDialog
    v-if="deletingPost"
    :open="deletingPost !== undefined"
    :author-name="deletingPostAuthor"
    :pending="removingPost"
    :error="deletePostError"
    @update:open="deletingPost = $event ? deletingPost : undefined"
    @confirmed="confirmDeletePost"
  />
</template>
