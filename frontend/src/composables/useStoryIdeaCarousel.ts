import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useGetStoryIdeaCarousel } from '@/api/story-ideas/story-ideas'
import type { GetStoryIdea200 } from '@/api/models'
import { ApiError } from '@/lib/api/apiFetch'

/**
 * The carousel's walk through the open ideas a member has not read.
 *
 * Two conditional queries keep it going, both against the same endpoint and both asking about
 * an idea rather than a position — a member posting an idea meanwhile cannot move anybody's
 * place, which an offset would. The *forward* one asks about the last idea loaded whenever the
 * reader is within a slide of it, so there is always something to move to; without that
 * lookahead the arrow would go dead for one round trip on every single step. The *backward*
 * one only fires at the first slide, since the walk starts by going forwards.
 *
 * The track only ever grows, because appending leaves the indices of everything before it
 * alone. Prepending does not, which is why it bumps `revision` for the view to re-centre on.
 */
export function useStoryIdeaCarousel() {
  const route = useRoute()
  const router = useRouter()

  /** The ideas loaded so far, in the order they are walked: newest first. */
  const track = ref<GetStoryIdea200[]>([])
  const index = ref<number>(0)

  /** Counts changes to the track, so the view knows to re-measure and re-centre. */
  const revision = ref<number>(0)

  const total = ref<number>(0)
  const startReached = ref<boolean>(false)
  const endReached = ref<boolean>(false)

  /**
   * The idea the URL named on arrival. A ref rather than a constant because a stale one is
   * dropped: clearing it is what lets the same query start the walk over.
   */
  const urlAnchor = ref<string | undefined>(
    route.params.ideaId === undefined ? undefined : String(route.params.ideaId),
  )

  const forwardAnchor = computed<string | undefined>(
    () => track.value.at(-1)?.id ?? urlAnchor.value,
  )
  const needForward = computed<boolean>(
    () => !endReached.value && index.value >= track.value.length - 2,
  )

  const backwardAnchor = computed<string | undefined>(() => track.value.at(0)?.id)
  const needBackward = computed<boolean>(
    () => !startReached.value && track.value.length > 0 && index.value <= 0,
  )

  const forward = useGetStoryIdeaCarousel(() => ({ storyIdeaId: forwardAnchor.value }), {
    query: { enabled: needForward },
  })
  const backward = useGetStoryIdeaCarousel(() => ({ storyIdeaId: backwardAnchor.value }), {
    query: { enabled: needBackward },
  })

  type Step = {
    previous: GetStoryIdea200 | null
    storyIdea: GetStoryIdea200 | null
    next: GetStoryIdea200 | null
    total: number
  }

  function merge(step: Step) {
    total.value = step.total

    if (step.storyIdea === null) {
      track.value = []
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
      revision.value += 1
      return
    }

    const at = track.value.findIndex((idea) => idea.id === step.storyIdea?.id)

    // A response about an idea no longer in the track: the reader has moved on, so it says
    // nothing about where they are now.
    if (at === -1) {
      return
    }

    // A cached answer can arrive again — a refetch on focus, a key walked back to — and the
    // same idea must not join the track twice.
    const holds = (idea: GetStoryIdea200 | null) =>
      idea !== null && track.value.some((loaded) => loaded.id === idea.id)

    if (at === track.value.length - 1 && !holds(step.next)) {
      if (step.next === null) {
        endReached.value = true
      } else {
        track.value = [...track.value, step.next]
        revision.value += 1
      }
    }

    if (at === 0 && !holds(step.previous)) {
      if (step.previous === null) {
        startReached.value = true
      } else {
        track.value = [step.previous, ...track.value]
        // Everything shifted by one, this reader's own position included.
        index.value += 1
        revision.value += 1
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
   * An anchor that is not part of this set — the member's own idea, a closed one, an author
   * they have blocked — starts the walk over rather than showing an error page. The link is
   * stale, not wrong.
   */
  watch(
    () => forward.error.value,
    (error) => {
      if (error instanceof ApiError && error.status === 404 && track.value.length === 0) {
        urlAnchor.value = undefined
        void router.replace({ name: 'storyIdeasCarousel', params: {} })
      }
    },
  )

  const current = computed<GetStoryIdea200 | undefined>(() => track.value[index.value])

  function goTo(next: number) {
    if (next < 0 || next >= track.value.length || next === index.value) {
      return
    }

    index.value = next
  }

  /**
   * The URL names whatever is on screen, from the first idea onwards — a carousel opened
   * without an anchor still has to survive a reload. Replaced rather than pushed: a step is
   * movement inside a view, not a new place to go, and twenty steps must not mean twenty
   * presses of the back button to leave.
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
   * Marks one loaded slide without refetching, which would drop the reader's place — and
   * carries the count with it, because nothing else will: the endpoint is asked about *an
   * idea*, so every key the walk has visited answers from cache with the total it had then.
   * Waiting for the next step left it frozen for the whole session.
   *
   * Unread is the *absence* of a state, so "gemerkt" takes an idea out of this set as surely
   * as "gelesen" does, and clearing either puts it back.
   */
  function setReaderStateLocally(ideaId: string, state: 'read' | 'marked' | null) {
    const previous = track.value.find((idea) => idea.id === ideaId)?.readerState ?? null

    if (previous === null && state !== null) {
      total.value = Math.max(0, total.value - 1)
    } else if (previous !== null && state === null) {
      total.value += 1
    }

    track.value = track.value.map((idea) =>
      idea.id === ideaId ? { ...idea, readerState: state } : idea,
    )
  }

  return {
    track,
    index,
    revision,
    total,
    current,
    startReached,
    endReached,
    isPending: computed<boolean>(() => forward.isPending.value && track.value.length === 0),
    isError: computed<boolean>(() => forward.isError.value && track.value.length === 0),
    goTo,
    setReaderStateLocally,
  }
}
