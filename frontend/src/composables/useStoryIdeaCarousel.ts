import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGetStoryIdeaCarousel } from '@/api/story-ideas/story-ideas'
import type { GetStoryIdea200 } from '@/api/models'
import { ApiError } from '@/lib/api/apiFetch'

type Step = {
  previous: GetStoryIdea200 | null
  storyIdea: GetStoryIdea200 | null
  next: GetStoryIdea200 | null
  total: number
}

/**
 * The carousel's walk through the open ideas a member has not read.
 *
 * It asks `QUERY /story-ideas/carousel` about *an idea* rather than about a position, because
 * every idea anybody posts shifts every position behind it. Two conditional queries keep the
 * track fed: one about the last idea loaded, one about the first.
 *
 * The track only grows, and the view shows one slide of it at a time. Appending leaves every
 * index meaning what it did; prepending shifts them, which is the one thing the view has to
 * take account of — it re-anchors without animating rather than sliding.
 */
export function useStoryIdeaCarousel() {
  const route = useRoute()
  const router = useRouter()

  /** The ideas loaded so far, in the order they are walked: newest first. */
  const track = ref<GetStoryIdea200[]>([])

  /** Which of them the reader is looking at. */
  const index = ref<number>(0)

  const total = ref<number>(0)
  const startReached = ref<boolean>(false)
  const endReached = ref<boolean>(false)

  /** Counts ideas added to the *front*, which is when the view must not animate the change. */
  const prepends = ref<number>(0)

  /** The idea the URL named on arrival, dropped once stale so the walk can start over. */
  const anchor = ref<string | undefined>(
    route.params.ideaId === undefined ? undefined : String(route.params.ideaId),
  )

  // Two slides of lookahead, so the reader never reaches a slide with nothing beyond it.
  const forward = useGetStoryIdeaCarousel(
    () => ({ storyIdeaId: track.value.at(-1)?.id ?? anchor.value }),
    {
      query: {
        enabled: computed(() => !endReached.value && index.value >= track.value.length - 2),
      },
    },
  )

  // Only at the very front, since a walk that started at the newest has everything behind it.
  const backward = useGetStoryIdeaCarousel(() => ({ storyIdeaId: track.value.at(0)?.id }), {
    query: {
      enabled: computed(() => !startReached.value && track.value.length > 0 && index.value === 0),
    },
  })

  function merge(step: Step) {
    total.value = step.total

    if (step.storyIdea === null) {
      startReached.value = true
      endReached.value = true
      return
    }

    if (track.value.length === 0) {
      track.value = [step.previous, step.storyIdea, step.next].filter(
        (idea): idea is GetStoryIdea200 => idea !== null,
      )
      index.value = step.previous === null ? 0 : 1
      startReached.value = step.previous === null
      endReached.value = step.next === null
      return
    }

    const at = track.value.findIndex((idea) => idea.id === step.storyIdea?.id)
    // A cached answer can arrive again, and an idea must not join the track twice.
    const holds = (idea: GetStoryIdea200 | null) =>
      idea !== null && track.value.some((loaded) => loaded.id === idea.id)

    if (at === track.value.length - 1 && !holds(step.next)) {
      if (step.next === null) {
        endReached.value = true
      } else {
        track.value = [...track.value, step.next]
      }
    }

    if (at === 0 && !holds(step.previous)) {
      if (step.previous === null) {
        startReached.value = true
      } else {
        track.value = [step.previous, ...track.value]
        index.value += 1
        prepends.value += 1
      }
    }
  }

  watch([() => forward.data.value, () => backward.data.value], ([forwardData, backwardData]) => {
    for (const response of [forwardData, backwardData]) {
      if (response?.status === 200) {
        merge(response.data)
      }
    }
  })

  /**
   * An anchor that is not part of this set — closed since, its author blocked, deleted — starts
   * the walk over rather than showing an error page: the link is out of date, not wrong.
   * Clearing it is what lets the same query recover.
   */
  watch(
    () => forward.error.value,
    (error) => {
      if (error instanceof ApiError && error.status === 404 && track.value.length === 0) {
        anchor.value = undefined
        void router.replace({ name: 'storyIdeasCarousel', params: {} })
      }
    },
  )

  const current = computed<GetStoryIdea200 | undefined>(() => track.value[index.value])

  const clamp = (slide: number) => Math.min(Math.max(slide, 0), track.value.length - 1)

  /**
   * The URL names whatever is on screen, from the first idea onwards, so a reload resumes.
   * Replaced rather than pushed: a step is movement inside a view, and twenty of them must not
   * mean twenty presses of the back button to leave.
   */
  watch(
    current,
    (idea) => {
      if (idea !== undefined && route.params.ideaId !== idea.id) {
        void router.replace({ name: 'storyIdeasCarousel', params: { ideaId: idea.id } })
      }
    },
    { immediate: true },
  )

  /**
   * Marks one loaded slide, and carries the count with it because nothing else will: the
   * endpoint is asked about *an idea*, so every key the walk has visited answers from cache with
   * the total it had then, and waiting for the next step left it frozen for the whole session.
   *
   * Unread is the *absence* of a record, so marking one read takes it out of this set and
   * clearing that puts it back.
   */
  function setReadLocally(ideaId: string, isRead: boolean) {
    const previous = track.value.find((idea) => idea.id === ideaId)?.isRead ?? false

    if (!previous && isRead) {
      total.value = Math.max(0, total.value - 1)
    } else if (previous && !isRead) {
      total.value += 1
    }

    track.value = track.value.map((idea) => (idea.id === ideaId ? { ...idea, isRead } : idea))
  }

  /**
   * The favourite's counterpart, and simpler for a reason worth stating: favouriting does not move
   * an idea in or out of this set — only reading does — so there is no total to adjust. The slide
   * still has to be updated by hand, because refetching would rebuild the set around the reader.
   */
  function setFavouriteLocally(ideaId: string, isFavourite: boolean) {
    track.value = track.value.map((idea) => (idea.id === ideaId ? { ...idea, isFavourite } : idea))
  }

  return {
    track,
    index,
    prepends,
    total,
    current,
    startReached,
    endReached,
    isPending: computed<boolean>(() => forward.isPending.value && track.value.length === 0),
    isError: computed<boolean>(() => forward.isError.value && track.value.length === 0),
    goTo: (slide: number) => {
      index.value = clamp(slide)
    },
    setReadLocally,
    setFavouriteLocally,
  }
}
