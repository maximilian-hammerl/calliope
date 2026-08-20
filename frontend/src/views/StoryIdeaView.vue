<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getListStoryIdeasQueryKey,
  useDeleteStoryIdea,
  useGetStoryIdea,
  useStartStoryIdeaConversation,
} from '@/api/story-ideas/story-ideas'
import { getListChatsQueryKey } from '@/api/chats/chats'
import { useGetCurrentUser } from '@/api/auth/auth'
import { MessageCircle } from '@lucide/vue'
import { openChatDialog } from '@/lib/chat/openChatDialog'
import type { GetStoryIdea200 } from '@/api/models'
import { ApiError } from '@/lib/api/apiFetch'
import { queryClient } from '@/lib/api/queryClient'
import { listKeyPrefix } from '@/lib/api/queryKeys'
import { formatActivityTime } from '@/lib/format/formatTime'
import { IDEA_STATUS_LABELS, LANGUAGE_LABELS, PARTY_SIZE_LABELS } from '@/lib/format/storyIdea'
import AppLayout from '@/components/layout/AppLayout.vue'
import StoryIdeaDialog from '@/components/story-idea/StoryIdeaDialog.vue'
import CalliopeBadge from '@/components/common/CalliopeBadge.vue'
import { Button } from '@/components/ui/button'

const route = useRoute()
const router = useRouter()
const ideaId = computed<string>(() => String(route.params.ideaId))

const { data, isPending, error } = useGetStoryIdea(ideaId)

const idea = computed<GetStoryIdea200 | undefined>(() =>
  data.value?.status === 200 ? data.value.data : undefined,
)

const { mutateAsync: startConversation, isPending: startingConversation } =
  useStartStoryIdeaConversation()
const conversationError = ref<string | undefined>(undefined)

/** Creates the chat with the author invited, then opens the messages dialog on it. */
async function askAboutIdea() {
  conversationError.value = undefined
  try {
    const created = await startConversation({ ideaId: ideaId.value })
    if (created.status !== 201) {
      return
    }
    await queryClient.invalidateQueries({ queryKey: listKeyPrefix(getListChatsQueryKey()) })
    openChatDialog(created.data.id)
  } catch {
    conversationError.value = 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
  }
}

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

/** The seeking block, only the lines that were filled in. */
const seeking = computed<Array<{ label: string; value: string }>>(() => {
  if (idea.value === undefined) {
    return []
  }
  return [
    { label: 'Gesucht', value: idea.value.lookingFor ?? undefined },
    {
      label: 'Konstellation',
      value: idea.value.partySize ? PARTY_SIZE_LABELS[idea.value.partySize] : undefined,
    },
    { label: 'Sprache', value: LANGUAGE_LABELS[idea.value.language] },
  ].filter((entry): entry is { label: string; value: string } => entry.value !== undefined)
})

/** The story block, mirroring the group's reference card. */
const story = computed<Array<{ label: string; value: string }>>(() => {
  if (idea.value === undefined) {
    return []
  }
  const list = (tags: readonly string[]) => (tags.length === 0 ? undefined : tags.join(', '))
  return [
    { label: 'Genre', value: list(idea.value.genres) },
    { label: 'Subgenre', value: list(idea.value.subgenres) },
    { label: 'Tropes', value: list(idea.value.tropes) },
    { label: 'Zeitform', value: idea.value.tense ?? undefined },
    { label: 'Perspektive', value: idea.value.perspective ?? undefined },
    { label: 'Inhaltswarnungen', value: list(idea.value.contentWarnings) },
  ].filter((entry): entry is { label: string; value: string } => entry.value !== undefined)
})

const editing = ref<boolean>(false)
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
  await router.push({ name: 'storyIdeasMine' })
}
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-[18px] py-5 pb-8 md:px-10">
      <div class="max-w-[760px]">
        <div v-if="isPending" class="text-[12.5px] text-ink-5">Einen Moment.</div>

        <template v-else-if="idea">
          <div class="flex flex-wrap items-baseline gap-3">
            <h1 class="text-[25px] leading-[1.2] text-ink-1">
              {{ idea.title }}
              <CalliopeBadge class="ml-3">{{ IDEA_STATUS_LABELS[idea.status] }}</CalliopeBadge>
            </h1>

            <div v-if="isOwn" class="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" @click="editing = true">Bearbeiten</Button>
              <Button variant="ghost" size="sm" :disabled="removing" @click="remove">
                Entfernen
              </Button>
            </div>

            <!-- The visitor's one action, solid for that reason. Only while the idea is open:
                 closed means the author asked not to be asked, and the API enforces it too. -->
            <div v-else-if="idea.status === 'open'" class="ml-auto">
              <Button size="sm" :disabled="startingConversation" @click="askAboutIdea">
                <MessageCircle data-icon="inline-start" :stroke-width="1.5" />
                Unterhaltung beginnen
              </Button>
            </div>
          </div>

          <p
            v-if="idea.subtitle"
            class="mt-[4px] max-w-[60ch] text-[13.5px] leading-[1.5] text-ink-3"
          >
            {{ idea.subtitle }}
          </p>

          <p v-if="removalError" class="mt-3 text-[12.5px] text-destructive" role="alert">
            {{ removalError }}
          </p>

          <p v-if="conversationError" class="mt-3 text-[12.5px] text-destructive" role="alert">
            {{ conversationError }}
          </p>

          <div class="mt-2 text-[12.5px] text-ink-5">
            von
            <RouterLink
              :to="{ name: 'member', params: { userId: idea.createdBy } }"
              class="underline-offset-[6px] hover:underline"
            >
              {{ idea.createdByUsername }}
            </RouterLink>
            · {{ formatActivityTime(idea.createdAt) }}
          </div>

          <p class="prose-post mt-6 max-w-[60ch]" style="text-wrap: pretty">
            {{ idea.idea }}
          </p>

          <div
            class="mt-8 grid max-w-[60ch] grid-cols-1 gap-8 border-t border-line-3 pt-6 sm:grid-cols-2"
          >
            <div v-if="seeking.length > 0">
              <div class="mb-[10px] text-[12.5px] font-semibold text-ink-4">Die Suche</div>
              <div class="text-[12.5px] leading-[1.95] text-ink-4">
                <div v-for="entry in seeking" :key="entry.label">
                  <span class="text-ink-6">{{ entry.label }}:&nbsp;</span>
                  <span>{{ entry.value }}</span>
                </div>
              </div>
            </div>

            <div v-if="story.length > 0">
              <div class="mb-[10px] text-[12.5px] font-semibold text-ink-4">Die Geschichte</div>
              <div class="text-[12.5px] leading-[1.95] text-ink-4">
                <div v-for="entry in story" :key="entry.label">
                  <span class="text-ink-6">{{ entry.label }}:&nbsp;</span>
                  <span>{{ entry.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="notFound">
          <h1 class="text-[25px] leading-[1.2]">Keine Idee gefunden</h1>
          <p class="mt-5 max-w-[46ch] text-[13.5px] leading-[1.7] text-ink-4">
            Diese Idee gibt es nicht mehr, oder der Link stimmt nicht.
          </p>
        </template>

        <template v-else>
          <h1 class="text-[25px] leading-[1.2]">Das hat nicht geklappt</h1>
          <p class="mt-5 max-w-[46ch] text-[13.5px] leading-[1.7] text-ink-4">
            Wir konnten diese Idee gerade nicht laden. Versuche es später noch einmal.
          </p>
        </template>
      </div>
    </div>
  </AppLayout>

  <StoryIdeaDialog v-if="idea" v-model:open="editing" :idea="idea" />
</template>
