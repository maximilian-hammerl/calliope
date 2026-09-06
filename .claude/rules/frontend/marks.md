---
paths:
  - "frontend/src/components/favourite/**"
  - "frontend/src/components/common/StateMark.vue"
  - "frontend/src/components/common/CalliopeBadge.vue"
  - "frontend/src/components/**/*Mark.vue"
  - "frontend/src/lib/format/favourite.ts"
  - "frontend/src/lib/format/forum.ts"
  - "frontend/src/lib/format/storyStatus.ts"
  - "frontend/src/composables/useFavourite.ts"
---

# Favourites and the marks

One favourite mark over six kinds. The wording lives in `lib/format/favourite.ts` — never write
„Favorit" at a call site; it was copied by hand once already.

- **`FavouriteToggle` emits its success and shows its own failure.** What to refetch differs per
  caller; the message is the same sentence everywhere, and delegating it is how it went unshown for
  five call sites. It renders in an `inline-flex` box so it stays one flex item in a row.
- **A post's row and the chat header use a raw button** — text actions on one baseline — and carry
  the 44px rule themselves.
- **`FilterStrip` on every list that shows a favouritable kind.**

## The five marks

**`StateMark` owns the chrome** — 13px glyph, the `mark` badge variant, `aria-label` *and* `title`;
these are the only icons here that are not `aria-hidden`. `FavouriteMark`, `ReadMark`, `StatusMark`,
`VisibilityMark` and `ForumPermissionMark` each read glyph and word from a map in `lib/format/`, so a
row and a page cannot say one state two ways. The two that carry the thing's *own* fact render both
states; the two that carry the *reader's* render one — a reader's non-state is not a state.

A mark is 25px where the word was 60, which is why it exists: as a word it pushed the chats rail's
unread count onto a second line. **Page headings keep the word, which is what teaches the mark.**

`interactive` makes a mark a popover trigger — opt-in, because inside a search result or a chat row
it would be a button inside a link. Its costs are written in the component: extra tab stops, and a
37×33 target under the 44px rule.

**`ForumPermissionMark`'s word depends on who is reading** — „Mitglieder können nur lesen" to an
operator, „Du kannst hier nur lesen" to a member. It is the one mark on a `PencilOff`: a negation
stands without its opposite, which the `Eye` it replaced could not do for members who never see an
`EyeOff`. `write` renders nothing; marking the ordinary case would bury the one that matters.

**`VisibilityMark` ships as an open question**: `Lock` and `LockOpen` are a shackle apart at 13px on
the fact whose misreading costs most. The design system records what else was tried.
