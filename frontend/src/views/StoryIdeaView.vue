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
import { MessageCircle, Pencil, Plus, Trash2 } from '@lucide/vue'
import type { GetStoryIdea200 } from '@/api/models'
import { ApiError } from '@/lib/api/apiFetch'
import { queryClient } from '@/lib/api/queryClient'
import { listKeyPrefix, listOnlyFilter } from '@/lib/api/queryKeys'
import { readToggle } from '@/lib/format/storyIdea'
import { useStoryIdeaActions } from '@/composables/useStoryIdeaActions'
import AppLayout from '@/components/layout/AppLayout.vue'
import GroupDialog from '@/components/group/GroupDialog.vue'
import type { GroupInitialValues } from '@/components/group/GroupDialog.vue'
import StoryIdeaDetail from '@/components/story-idea/StoryIdeaDetail.vue'
import DeleteStoryIdeaDialog from '@/components/story-idea/DeleteStoryIdeaDialog.vue'
import StoryIdeaDialog from '@/components/story-idea/StoryIdeaDialog.vue'
import ReportDialog from '@/components/report/ReportDialog.vue'
import { Button } from '@/components/ui/button'

const route = useRoute()
const router = useRouter()
const ideaId = computed<string>(() => String(route.params.ideaId))

const { data, isPending, error } = useGetStoryIdea(ideaId)

const idea = computed<GetStoryIdea200 | undefined>(() =>
  data.value?.status === 200 ? data.value.data : undefined,
)

const { savingRead, changeRead, startingConversation, conversationError, askAboutIdea } =
  useStoryIdeaActions()

/** The page shows one idea, so it can simply refetch what it changed. */
async function markIdea(isRead: boolean) {
  await changeRead(ideaId.value, isRead)
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
  await router.push({ name: 'storyIdeasMine' })
}
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-gutter py-5 pb-8 md:px-10">
      <div v-if="isPending" class="text-[12.5px] text-ink-5">Einen Moment.</div>

      <StoryIdeaDetail v-else-if="idea" :idea="idea" :own="isOwn">
        <template #actions>
          <template v-if="isOwn">
            <Button variant="outline" size="sm" @click="foundingGroup = true">
              <Plus :stroke-width="1.5" />
              Gruppe gründen
            </Button>
            <Button variant="outline" size="sm" @click="editing = true">
              <Pencil :stroke-width="1.5" />
              Bearbeiten
            </Button>
            <Button variant="outline" size="sm" :disabled="removing" @click="deleting = true">
              <Trash2 :stroke-width="1.5" />
              Löschen
            </Button>
          </template>

          <!-- The visitor's one action, solid for that reason. Only while the idea is open:
               closed means the author asked not to be asked, and the API enforces it too. -->
          <template v-else>
            <!-- Choosing the state an idea already has clears it, which is why the label
                 names the state rather than the act. -->
            <Button
              v-for="toggle in [readToggle(idea.isRead)]"
              :key="toggle.title"
              variant="outline"
              size="sm"
              :title="toggle.title"
              :disabled="savingRead"
              @click="markIdea(toggle.next)"
            >
              {{ toggle.label }}
            </Button>
            <Button variant="ghost" size="sm" @click="reporting = true">Melden</Button>
            <!-- Disabled rather than hidden on a closed idea: the endpoint answers 403, and
                 a member who kept the idea should see why they cannot write. -->
            <Button
              size="sm"
              :disabled="startingConversation || idea.status === 'closed'"
              :title="
                idea.status === 'closed'
                  ? 'Diese Storyidee ist geschlossen und kann nicht mehr beantwortet werden'
                  : undefined
              "
              @click="askAboutIdea(idea.id)"
            >
              <MessageCircle :stroke-width="1.5" />
              Chat beginnen
            </Button>
          </template>
        </template>

        <template #notices>
          <p v-if="conversationError" class="mt-3 text-[12.5px] text-destructive" role="alert">
            {{ conversationError }}
          </p>
        </template>
      </StoryIdeaDetail>

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
  </AppLayout>

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
    @saved="openGroup"
  />
</template>
