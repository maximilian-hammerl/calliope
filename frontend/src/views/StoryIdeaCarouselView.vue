<script setup lang="ts">
import { ref, watch } from 'vue'
import { ArrowLeft, ArrowRight, MessageCircle } from '@lucide/vue'
import { getListStoryIdeasQueryKey } from '@/api/story-ideas/story-ideas'
import type { GetStoryIdea200 } from '@/api/models'
import { queryClient } from '@/lib/api/queryClient'
import { listOnlyFilter } from '@/lib/api/queryKeys'
import { readerStateToggles } from '@/lib/format/storyIdea'
import { useStoryIdeaActions } from '@/composables/useStoryIdeaActions'
import { useStoryIdeaCarousel } from '@/composables/useStoryIdeaCarousel'
import AppLayout from '@/components/layout/AppLayout.vue'
import StoryIdeaDetail from '@/components/story-idea/StoryIdeaDetail.vue'
import { Button } from '@/components/ui/button'

const {
  track,
  index,
  prepends,
  total,
  startReached,
  endReached,
  isPending,
  isError,
  goTo,
  setReaderStateLocally,
} = useStoryIdeaCarousel()

const {
  savingReaderState,
  changeReaderState,
  startingConversation,
  conversationError,
  askAboutIdea,
} = useStoryIdeaActions()

/**
 * Whether the next change of `index` is a step the reader took, and so worth animating.
 *
 * An idea loaded at the *front* shifts every slide behind it: the index moves by one while what
 * is on screen must not, so that one change is re-anchoring rather than movement. Switching the
 * transition off in a `pre` watcher gets it out of the way before the render that re-anchors,
 * and the reader's next step turns it back on — no waiting on a frame to be sure of the order.
 */
const animating = ref<boolean>(true)
watch(prepends, () => {
  animating.value = false
})

function step(by: number) {
  animating.value = true
  goTo(index.value + by)
}

/**
 * The slide keeps its own new state rather than the query refetching: a refetch would rebuild
 * the set around the reader and take the idea they are looking at out of it. The board is
 * invalidated instead, because that is where the change has to show.
 */
async function markIdea(ideaId: string, state: GetStoryIdea200['readerState']) {
  await changeReaderState(ideaId, state)
  setReaderStateLocally(ideaId, state)
  await queryClient.invalidateQueries(listOnlyFilter(getListStoryIdeasQueryKey()))
}
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-gutter py-5 pb-8 md:px-10">
      <div class="max-w-[760px]">
        <h1 class="mb-2 text-h1 text-ink-1">Story-Karussell</h1>
        <p class="mb-6 max-w-[60ch] text-body text-ink-4">
          Offene Ideen, die du noch nicht gelesen hast — eine nach der anderen.
        </p>

        <p v-if="isPending" class="text-[12.5px] text-ink-5">Einen Moment.</p>

        <p v-else-if="isError" class="text-[12.5px] text-ink-5">
          Die Storyideen lassen sich gerade nicht laden. Versuche es später noch einmal.
        </p>

        <p v-else-if="track.length === 0" class="max-w-[46ch] text-body text-ink-4">
          Du hast alle offenen Storyideen gelesen. Neue erscheinen hier, sobald sie geschrieben
          werden.
        </p>

        <!-- Room either side for the two buttons, which sit beside the idea from `md` up and
             share the line above it on a phone, where there is no room outside. -->
        <div v-else class="relative md:mx-14">
          <div class="mb-5 flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              class="size-11 rounded-full md:absolute md:top-1/2 md:-left-12 md:size-8 md:-translate-y-1/2"
              :disabled="index === 0"
              aria-label="Vorherige Storyidee"
              @click="step(-1)"
            >
              <ArrowLeft :stroke-width="1.5" />
            </Button>

            <div class="text-[12.5px] leading-[1.6] text-ink-5">
              <template v-if="endReached && index === track.length - 1">
                Das war die letzte ungelesene Storyidee.
              </template>
              <template v-else-if="startReached && index === 0">
                Die neueste von {{ total }} ungelesenen
                {{ total === 1 ? 'Storyidee' : 'Storyideen' }}.
              </template>
              <template v-else>
                Noch {{ total }} ungelesene {{ total === 1 ? 'Storyidee' : 'Storyideen' }}
              </template>
            </div>

            <Button
              variant="outline"
              size="icon"
              class="ml-auto size-11 rounded-full md:absolute md:top-1/2 md:-right-12 md:size-8 md:-translate-y-1/2"
              :disabled="index === track.length - 1"
              aria-label="Nächste Storyidee"
              @click="step(1)"
            >
              <ArrowRight :stroke-width="1.5" />
            </Button>
          </div>

          <div class="overflow-hidden">
            <div
              class="flex"
              :class="
                animating
                  ? 'motion-safe:transition-transform motion-safe:duration-[220ms] motion-safe:ease-[cubic-bezier(.2,0,.2,1)]'
                  : ''
              "
              :style="{ transform: `translateX(-${index * 100}%)` }"
            >
              <div v-for="idea in track" :key="idea.id" class="w-full shrink-0 grow-0">
                <StoryIdeaDetail :idea="idea" heading="h2">
                  <template #actions>
                    <!-- Choosing the state an idea already has clears it, which is why the label
                         names the state rather than the act. -->
                    <Button
                      v-for="toggle in readerStateToggles(idea.readerState)"
                      :key="toggle.title"
                      variant="outline"
                      size="sm"
                      :title="toggle.title"
                      :disabled="savingReaderState"
                      @click="markIdea(idea.id, toggle.next)"
                    >
                      {{ toggle.label }}
                    </Button>
                    <Button
                      size="sm"
                      :disabled="startingConversation"
                      @click="askAboutIdea(idea.id)"
                    >
                      <MessageCircle :stroke-width="1.5" />
                      Chat beginnen
                    </Button>
                  </template>
                  <template #notices>
                    <p
                      v-if="conversationError"
                      class="mt-3 text-[12.5px] text-destructive"
                      role="alert"
                    >
                      {{ conversationError }}
                    </p>
                  </template>
                </StoryIdeaDetail>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>
