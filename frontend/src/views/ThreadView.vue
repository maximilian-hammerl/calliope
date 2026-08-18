<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { useGetGroup } from '@/api/groups/groups'
import { useGetThread, useListThreads } from '@/api/threads/threads'
import { getListPostsQueryKey, useCreatePost, useListPosts, useUpdatePost } from '@/api/posts/posts'
import { useListMemberships } from '@/api/memberships/memberships'
import type {
  GetGroup200,
  GetThread200,
  ListMemberships200ResultsItem,
  ListPosts200ResultsItem,
  ListThreads200ResultsItem,
} from '@/api/models'
import AppLayout from '@/components/AppLayout.vue'
import CreateGroupDialog from '@/components/CreateGroupDialog.vue'
import GroupHeader from '@/components/GroupHeader.vue'
import ThreadTabs from '@/components/ThreadTabs.vue'
import CreateThreadDialog from '@/components/CreateThreadDialog.vue'
import ThreadHeader from '@/components/ThreadHeader.vue'
import PostItem from '@/components/PostItem.vue'
import { TEXT_LIMIT } from '@/api/textLimit'
import { formatCount } from '@/lib/formatNumber'
import { useDraft } from '@/lib/useDraft'
import PostComposer from '@/components/PostComposer.vue'
import StepList from '@/components/context/StepList.vue'
import StoryStatus from '@/components/context/StoryStatus.vue'
import FileList from '@/components/context/FileList.vue'
import MemberList from '@/components/context/MemberList.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useGroupRole } from '@/lib/useGroupRole'

const route = useRoute()
const queryClient = useQueryClient()

const groupId = computed<string>(() => String(route.params.groupId))
const threadId = computed<string>(() => String(route.params.threadId))

const { data: groupData } = useGetGroup(groupId)
const group = computed<GetGroup200 | undefined>(() =>
  groupData.value?.status === 200 ? groupData.value.data : undefined,
)

const { data: threadData, isPending, isError } = useGetThread(groupId, threadId)
const thread = computed<GetThread200 | undefined>(() =>
  threadData.value?.status === 200 ? threadData.value.data : undefined,
)

const threadsQuery = { limit: 100, sortAttribute: 'lastActivityAt', sortOrder: 'desc' } as const
const { data: threadsData } = useListThreads(groupId, threadsQuery)
const threads = computed<ListThreads200ResultsItem[]>(() =>
  threadsData.value?.status === 200 ? threadsData.value.data.results : [],
)

// Oldest first: a thread is read in the order it was written.
const postsQuery = { limit: 100, sortAttribute: 'createdAt', sortOrder: 'asc' } as const
const { data: postsData } = useListPosts(groupId, threadId, postsQuery)
const posts = computed<ListPosts200ResultsItem[]>(() =>
  postsData.value?.status === 200 ? postsData.value.data.results : [],
)
const postCount = computed<number | undefined>(() =>
  postsData.value?.status === 200 ? postsData.value.data.totalResults : undefined,
)

const { data: membershipsData } = useListMemberships(groupId, { limit: 100 })
const memberships = computed<ListMemberships200ResultsItem[]>(() =>
  membershipsData.value?.status === 200 ? membershipsData.value.data.results : [],
)

const { mayWrite } = useGroupRole(memberships)

const draft = ref<string>('')
const sendError = ref<string | undefined>(undefined)
const creatingGroup = ref<boolean>(false)
const creatingThread = ref<boolean>(false)

const { mutateAsync: createPost, isPending: sending } = useCreatePost()
const { mutateAsync: publishDraft, isPending: publishing } = useUpdatePost()

// Owns the composer's text between visits: loads any existing draft into it, saves as it is
// written, and lets go of the row once it has been published.
const { status: draftStatus, draftId, forget: forgetDraft } = useDraft(groupId, threadId, draft)

async function submit() {
  sendError.value = undefined
  const text = draft.value.trim()
  if (text.length === 0) {
    return
  }

  // Checked here rather than with `maxlength` on the composer: prose stopping dead mid-word
  // with no explanation is worse than being told why, and the draft is kept either way.
  if (text.length > TEXT_LIMIT.createPost.text.maxLength) {
    sendError.value = `Der Beitrag ist zu lang. Er darf höchstens ${formatCount(TEXT_LIMIT.createPost.text.maxLength)} Zeichen haben.`
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
        data: { text, isDraft: false },
      })
      forgetDraft()
    } else {
      await createPost({ groupId: groupId.value, threadId: threadId.value, data: { text } })
    }
  } catch {
    sendError.value = 'Der Beitrag konnte nicht gesendet werden. Versuche es noch einmal.'
    return
  }

  // Only cleared once the post is really stored, so nothing a member wrote is lost.
  draft.value = ''
  await queryClient.invalidateQueries({
    queryKey: getListPostsQueryKey(groupId.value, threadId.value, postsQuery),
  })
}
</script>

<template>
  <AppLayout :active-group-id="groupId" @create-group="creatingGroup = true">
    <template v-if="thread">
      <GroupHeader
        v-if="group"
        :title="group.title"
        :visibility="group.visibility"
        :group-id="groupId"
      />

      <ThreadTabs
        :group-id="groupId"
        :threads="threads"
        :active-id="threadId"
        :may-write="mayWrite"
        @create="creatingThread = true"
      />

      <div class="flex-1 overflow-auto px-[18px] pt-7 pb-8 md:px-10">
        <div class="max-w-[684px]">
          <ThreadHeader
            :title="thread.title"
            :post-count="postCount"
            :last-activity-at="thread.lastActivityAt"
          />

          <p v-if="posts.length === 0" class="text-[13.5px] leading-[1.7] text-ink-4">
            Noch keine Beiträge in „{{ thread.title }}“.
            <template v-if="mayWrite">Schreib den ersten.</template>
          </p>

          <PostItem
            v-for="(post, index) in posts"
            :key="post.id"
            :post="post"
            :first="index === 0"
            :divider="index < posts.length - 1"
          />
        </div>
      </div>

      <div v-if="sendError" class="px-[18px] pb-3 md:px-10">
        <Alert variant="destructive" role="alert" class="max-w-[684px]">
          <AlertDescription>{{ sendError }}</AlertDescription>
        </Alert>
      </div>

      <!-- Readers may read and comment, so they get no composer. -->
      <PostComposer
        v-if="mayWrite"
        v-model="draft"
        :sending="sending || publishing"
        :draft-status="draftStatus"
        @submit="submit"
      />
    </template>

    <div v-else-if="isPending" class="px-[18px] py-5 text-[12.5px] text-ink-5 md:px-10">
      Thread wird geladen …
    </div>

    <div v-else-if="isError" class="px-[18px] py-5 md:px-10">
      <p class="max-w-[46ch] text-[13.5px] leading-[1.7] text-ink-4">
        Diesen Thread gibt es nicht, oder du gehörst nicht zu seiner Gruppe.
      </p>
      <Button
        variant="outline"
        size="sm"
        class="mt-5"
        @click="$router.push({ name: 'group', params: { groupId } })"
      >
        Zur Gruppe
      </Button>
    </div>

    <template #rail>
      <StepList />
      <StoryStatus />
      <FileList />
      <MemberList :memberships="memberships" />
    </template>
  </AppLayout>

  <CreateGroupDialog v-model:open="creatingGroup" />
  <CreateThreadDialog v-model:open="creatingThread" :group-id="groupId" />
</template>
