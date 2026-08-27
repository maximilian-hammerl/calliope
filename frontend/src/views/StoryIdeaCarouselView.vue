<script setup lang="ts">
import { ref, watch } from 'vue'
import { ArrowLeft, ArrowRight } from '@lucide/vue'
import { getListStoryIdeasQueryKey } from '@/api/story-ideas/story-ideas'
import { queryClient } from '@/lib/api/queryClient'
import { listOnlyFilter } from '@/lib/api/queryKeys'
import { useStoryIdeaCarousel } from '@/composables/useStoryIdeaCarousel'
import AppLayout from '@/components/layout/AppLayout.vue'
import StoryIdeaDetail from '@/components/story-idea/StoryIdeaDetail.vue'
import ReportDialog from '@/components/report/ReportDialog.vue'
import { Button } from '@/components/ui/button'
import StoryIdeasViewStrip from '@/components/story-idea/StoryIdeasViewStrip.vue'

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
  setReadLocally,
  setFavouriteLocally,
} = useStoryIdeaCarousel()

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
 * The change itself has already happened in `StoryIdeaDetail`; what is left is the part only this
 * view can decide. The slide keeps its own new state rather than the query refetching, because a
 * refetch would rebuild the set around the reader and take the idea they are looking at out of it.
 * The board is invalidated instead, since that is where the change has to show.
 */
async function markIdea(ideaId: string, isRead: boolean) {
  setReadLocally(ideaId, isRead)
  await queryClient.invalidateQueries(listOnlyFilter(getListStoryIdeasQueryKey()))
}

/** The same rule as reading, minus the total: favouriting moves nothing in or out of the set. */
async function favouriteChanged(ideaId: string, isFavourite: boolean) {
  setFavouriteLocally(ideaId, isFavourite)
  await queryClient.invalidateQueries(listOnlyFilter(getListStoryIdeasQueryKey()))
}

/**
 * Which idea is being reported, and whether the dialog is open — two refs rather than one.
 * The carousel holds every slide at once, so the target cannot be a boolean on the slide; and the
 * target cannot drive the dialog either, because clearing it would unmount the dialog mid-close
 * and skip its exit animation. So the target is kept after closing and `reportingOpen` does the
 * opening. `ReportDialog` resets its own form whenever `open` changes, so a second report starts
 * clean whichever idea it is about.
 */
const reportingIdea = ref<{ id: string; title: string } | undefined>(undefined)
const reportingOpen = ref<boolean>(false)

function reportIdea(idea: { id: string; title: string }) {
  reportingIdea.value = { id: idea.id, title: idea.title }
  reportingOpen.value = true
}
</script>

<template>
  <AppLayout>
    <div class="flex-1 overflow-auto px-gutter py-5 pb-8 md:px-10">
      <h1 class="mb-2 text-h1 text-ink-1">Storyideen</h1>

      <div class="mb-2">
        <StoryIdeasViewStrip />
      </div>
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
              <StoryIdeaDetail
                :idea="idea"
                heading="h2"
                @read-changed="(isRead) => markIdea(idea.id, isRead)"
                @favourite-changed="(isFavourite) => favouriteChanged(idea.id, isFavourite)"
                @report="reportIdea(idea)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>

  <!-- One dialog for the whole track rather than one per slide: `reportingIdea` says which. The
       `v-if` only holds until the first report; after that it stays mounted so it can close. -->
  <ReportDialog
    v-if="reportingIdea"
    v-model:open="reportingOpen"
    target-type="story_idea"
    :target-id="reportingIdea.id"
    :subject="reportingIdea.title"
  />
</template>
