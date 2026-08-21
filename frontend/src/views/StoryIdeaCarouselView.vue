<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useEventListener, useMediaQuery } from '@vueuse/core'
import { MessageCircle } from '@lucide/vue'
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
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel'

const {
  track,
  index,
  prepends,
  total,
  startReached,
  endReached,
  isPending,
  isError,
  selectedOn,
  settledOn,
  setReaderStateLocally,
} = useStoryIdeaCarousel()

const {
  savingReaderState,
  changeReaderState,
  startingConversation,
  conversationError,
  askAboutIdea,
} = useStoryIdeaActions()

/** The one exception to "almost no motion" — and none of it for anyone who asked for less. */
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

/**
 * `duration` is present only when it has to be nothing. Embla merges options by copying every
 * key it finds, `undefined` included, so a `duration: undefined` overwrites its own default with
 * nothing — and a falsy duration is the branch that renders the last frame at once. That is not
 * a slower animation, it is no animation, and it looked like one of ours until the option merge
 * was read.
 *
 * Read once, when the carousel is created, which is also why `startIndex` can come from a ref.
 */
const carouselOptions = computed(() => ({
  startIndex: index.value,
  ...(reducedMotion.value ? { duration: 0 } : {}),
}))

const api = ref<CarouselApi | undefined>(undefined)

function onInitApi(carouselApi: CarouselApi) {
  api.value = carouselApi
  carouselApi?.on('select', () => selectedOn(carouselApi.selectedScrollSnap()))
  // Loading follows where the reader came to rest, so slides are only ever added between
  // movements: embla re-measures when they are, and a re-measure cuts a movement short.
  carouselApi?.on('settle', () => settledOn(carouselApi.selectedScrollSnap()))
}

/**
 * An idea added to the *front* shifts every slide behind it. Embla re-measures on its own —
 * `watchSlides` is on by default — but a re-measure keeps the selected index, and the index now
 * points at the idea before the one the reader was reading. This is the correction, and it only
 * happens after a reload part-way through the set.
 */
watch(prepends, async () => {
  await nextTick()
  api.value?.scrollTo(index.value, true)
})

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  // Not while somebody is typing, and not over a control that has its own arrow behaviour.
  if (target?.closest('input, textarea, select, [contenteditable="true"]') !== null) {
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    api.value?.scrollPrev()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    api.value?.scrollNext()
  }
})

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
    <div class="flex-1 overflow-auto px-[18px] py-5 pb-8 md:px-10">
      <div class="max-w-[760px]">
        <h1 class="mt-3 mb-2 text-[25px] leading-[1.2] text-ink-1">Story-Karussell</h1>
        <p class="mb-6 max-w-[60ch] text-[13.5px] leading-[1.7] text-ink-4">
          Offene Ideen, die du noch nicht gelesen hast — eine nach der anderen. Mit den Pfeiltasten
          oder per Wischen weiter.
        </p>

        <p v-if="isPending" class="text-[12.5px] text-ink-5">Einen Moment.</p>

        <p v-else-if="isError" class="text-[12.5px] text-ink-5">
          Die Storyideen lassen sich gerade nicht laden. Versuche es später noch einmal.
        </p>

        <p
          v-else-if="track.length === 0"
          class="max-w-[46ch] text-[13.5px] leading-[1.7] text-ink-4"
        >
          Du hast alle offenen Storyideen gelesen. Neue erscheinen hier, sobald sie geschrieben
          werden.
        </p>

        <!-- Room either side for the controls, which sit beside the idea from `md` up and share
             the line above it on a phone, where there is no room outside. -->
        <Carousel v-else class="md:mx-14" :opts="carouselOptions" @init-api="onInitApi">
          <div class="mb-5 flex items-center gap-4">
            <CarouselPrevious
              class="static translate-y-0 md:absolute md:top-1/2 md:-left-12 md:-translate-y-1/2"
            />
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
            <CarouselNext
              class="static ml-auto translate-y-0 md:absolute md:top-1/2 md:-right-12 md:ml-0 md:-translate-y-1/2"
            />
          </div>

          <CarouselContent>
            <CarouselItem v-for="idea in track" :key="idea.id">
              <StoryIdeaDetail :idea="idea" heading="h2">
                <template #actions>
                  <!-- Choosing the state an idea already has clears it, which is why the label
                       names the state rather than the act. -->
                  <Button
                    v-for="toggle in readerStateToggles(idea.readerState)"
                    :key="toggle.title"
                    variant="secondary"
                    size="sm"
                    :title="toggle.title"
                    :disabled="savingReaderState"
                    @click="markIdea(idea.id, toggle.next)"
                  >
                    {{ toggle.label }}
                  </Button>
                  <Button size="sm" :disabled="startingConversation" @click="askAboutIdea(idea.id)">
                    <MessageCircle data-icon="inline-start" :stroke-width="1.5" />
                    Unterhaltung beginnen
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
            </CarouselItem>
          </CarouselContent>
        </Carousel>
      </div>
    </div>
  </AppLayout>
</template>
