---
paths:
  - "frontend/src/composables/useStoryIdeaCarousel.ts"
  - "frontend/src/views/StoryIdeaCarouselView.vue"
  - "frontend/src/components/story-idea/**"
---

# The story-idea carousel walks by idea, never by position

`useStoryIdeaCarousel` holds the loaded ideas itself and asks `QUERY /story-ideas/carousel` about
*an idea*, which answers with the two either side. A page number in the URL would be wrong within
hours: the newest comes first, so every post shifts every position.

- **Two conditional queries, one endpoint.** The forward one asks about the *last* idea loaded
  whenever the reader is within a slide of it; without the lookahead the arrow goes dead for a round
  trip on every step. The backward one fires only at the first slide.
- **The track only grows.** `translateX(-index * 100%)` on a flex row, 220ms transition. Appending
  leaves every index meaning what it did, so an idea can join mid-transition.
- **Prepending shifts every index**, so the reader's moves by one while the screen must not: that
  change re-anchors in a `pre` watcher with the transition off.

**Deliberately not a carousel component.** Embla measured the DOM and every hard bug came from that
— a re-measure destroyed the animation it interrupted, and `duration: undefined` overwrote its own
default so nothing animated in any browser. A transform driven by an index measures nothing, and it
is the only version verifiable in the preview pane (inline transform at the target while the
computed one is still at the start = animation in flight). Swipe and keyboard are deliberately out.

The carousel uses `router.replace` where `usePagedList` uses `push`: twenty steps must not mean
twenty presses of back. It is reached from the **Storyideen menu**, not a button on the board, and
carries no link back. Marking an idea read updates the one slide **and the count** by hand and
invalidates only the *board* — every visited key answers from cache, so nothing would refetch a
fresh total, and invalidating the carousel's own query would take the idea on screen out of the
set. An anchor no longer in the set answers 404 and the composable clears it and starts at the
newest: the link is out of date, not wrong.

`StoryIdeaDetail` renders the actions and has no slots — its two callers filled `#actions`
themselves and drifted. What they still decide is emitted.
