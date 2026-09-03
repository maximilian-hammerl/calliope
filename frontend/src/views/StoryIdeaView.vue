<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getGetStoryIdeaQueryKey,
  getListStoryIdeasQueryKey,
  useDeleteStoryIdea,
  useGetStoryIdea,
} from '@/api/story-ideas/story-ideas'
import { useGetCurrentUser } from '@/api/auth/auth'
import type { GetStoryIdea200 } from '@/api/models'
import { ApiError } from '@/lib/api/apiFetch'
import { queryClient } from '@/lib/api/queryClient'
import { listKeyPrefix, listOnlyFilter } from '@/lib/api/queryKeys'
import GroupDialog from '@/components/group/GroupDialog.vue'
import type { GroupInitialValues } from '@/components/group/GroupDialog.vue'
import StoryIdeaDetail from '@/components/story-idea/StoryIdeaDetail.vue'
import DeleteStoryIdeaDialog from '@/components/story-idea/DeleteStoryIdeaDialog.vue'
import StoryIdeaDialog from '@/components/story-idea/StoryIdeaDialog.vue'
import ReportDialog from '@/components/report/ReportDialog.vue'

const route = useRoute()
const router = useRouter()
const ideaId = computed<string>(() => String(route.params.ideaId))

const { data, isPending, error } = useGetStoryIdea(ideaId)

const idea = computed<GetStoryIdea200 | undefined>(() =>
  data.value?.status === 200 ? data.value.data : undefined,
)

/** The page shows one idea, so it can simply refetch what it changed — and the board it came from. */
async function refreshIdea() {
  await queryClient.invalidateQueries({ queryKey: getGetStoryIdeaQueryKey(ideaId.value) })
  await queryClient.invalidateQueries(listOnlyFilter(getListStoryIdeasQueryKey()))
}

function openGroup(groupId: string) {
  void router.push({ name: 'group', params: { groupId } })
}

const foundingGroup = ref<boolean>(false)

/** Field for field, because the idea's story block mirrors writing_group by design. */
const groupInitialValues = computed<GroupInitialValues | undefined>(() =>
  idea.value === undefined
    ? undefined
    : {
        title: idea.value.title,
        subtitle: idea.value.subtitle ?? null,
        synopsis: idea.value.synopsis,
        genres: idea.value.genres,
        subgenres: idea.value.subgenres,
        tropes: idea.value.tropes,
        contentWarnings: idea.value.contentWarnings,
        storyThemes: idea.value.storyThemes,
        storySettings: idea.value.storySettings,
        tense: idea.value.tense ?? null,
        perspective: idea.value.perspective ?? null,
        language: idea.value.language,
      },
)

const notFound = computed<boolean>(
  () => error.value instanceof ApiError && error.value.status === 404,
)

const { data: userData } = useGetCurrentUser()
const isOwn = computed<boolean>(
  () =>
    userData.value?.status === 200 &&
    idea.value !== undefined &&
    userData.value.data.id === idea.value.createdBy,
)

const reporting = ref<boolean>(false)
const editing = ref<boolean>(false)
const deleting = ref<boolean>(false)
const removing = ref<boolean>(false)
const removalError = ref<string | undefined>(undefined)

const { mutateAsync: removeIdea } = useDeleteStoryIdea()

async function remove() {
  removalError.value = undefined
  removing.value = true

  try {
    await removeIdea({ ideaId: ideaId.value })
  } catch {
    removalError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
    removing.value = false
    return
  }

  await queryClient.invalidateQueries({ queryKey: listKeyPrefix(getListStoryIdeasQueryKey()) })
  deleting.value = false
  await router.push({ name: 'myStoryIdeas' })
}
</script>

<template>
  <div class="flex-1 overflow-auto px-gutter py-5 pb-8 md:px-10">
    <div v-if="isPending" class="text-[12.5px] text-ink-5">Einen Moment.</div>

    <StoryIdeaDetail
      v-else-if="idea"
      :idea="idea"
      :own="isOwn"
      @read-changed="refreshIdea"
      @favourite-changed="refreshIdea"
      @report="reporting = true"
      @edit="editing = true"
      @remove="deleting = true"
      @found-group="foundingGroup = true"
    />

    <template v-else-if="notFound">
      <h1 class="text-h1">Keine Idee gefunden</h1>
      <p class="mt-5 max-w-[46ch] text-body text-ink-4">
        Diese Idee gibt es nicht mehr, oder der Link stimmt nicht.
      </p>
    </template>

    <template v-else>
      <h1 class="text-h1">Das hat nicht geklappt</h1>
      <p class="mt-5 max-w-[46ch] text-body text-ink-4">
        Wir konnten diese Idee gerade nicht laden. Versuche es später noch einmal.
      </p>
    </template>
  </div>

  <ReportDialog
    v-if="idea"
    v-model:open="reporting"
    target-type="story_idea"
    :target-id="idea.id"
    :subject="idea.title"
  />

  <StoryIdeaDialog v-if="idea" v-model:open="editing" :idea="idea" />
  <DeleteStoryIdeaDialog
    v-if="idea"
    v-model:open="deleting"
    :title="idea.title"
    :pending="removing"
    :error="removalError"
    @confirmed="remove"
  />
  <GroupDialog
    v-if="idea"
    v-model:open="foundingGroup"
    :initial="groupInitialValues"
    @created="openGroup"
  />
</template>
