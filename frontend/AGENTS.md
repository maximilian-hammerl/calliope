# Frontend

Vue 3 with Vite, Tailwind v4, shadcn-vue, TanStack vue-query and an Orval-generated API
client. Linted by `oxlint`, formatted by `oxfmt`. Tasks are `npm run …` — see the root
[AGENTS.md](../AGENTS.md) for the conventions shared with the other projects.

- **File names are `camelCase`**, except when the file is a class or a component, which are
  `PascalCase`: `formatTime.ts`, `useDraft.ts`, `AppLayout.vue`.
- **Imports use the `@/` alias**, which points at `src/`: `@/lib/formatTime`.
- **Annotate every `ref` and `computed`**: `ref<string>('')`,
  `computed<GetGroup200 | undefined>(…)`.
- **Route paths are English, everything a member reads is German**: `/groups/:groupId`
  renders "Meine Gruppen".
- **Navigate through `useRouter()`, never `$router`.** The global property works in a template,
  but it is the pre-Composition-API idiom and it hides the dependency from the script. A named
  handler beside it also lets the returned promise be `void`ed, which a template expression
  cannot do. One file had both at once, which is how this drifted.

## The lint configuration is a record, not a default

`.oxlintrc.json` runs the `correctness`, `suspicious` and `perf` categories plus a handful of
named rules, and **every rule that was tried and rejected is listed there with what it cost** —
the same shape `backend/deno.jsonc` uses, so nobody re-tries `no-magic-numbers` on a codebase
whose design system *is* literal numbers.

Three things in it are easy to get wrong:

- **Globs resolve against the config file's directory.** Running `oxlint -c /tmp/something.json`
  silently applies no `overrides` at all and lints what `ignorePatterns` should have excluded. A
  measurement taken that way is wrong in both directions.
- **A type-only import is its own statement.** `import type { Ref } from 'vue'` above
  `import { computed } from 'vue'`, never `import { computed, type Ref }`. Two lines from one
  module is the price: a line that vanishes at compile time should say so, rather than hiding a
  `type` marker in the middle of a list. `import/no-duplicates` tolerates the pair on purpose.
- **`components/ui/**` is exempted from `import/no-cycle`**, because it is generated and not
  reorganised: shadcn's `index.ts` and its components import each other, which is ten cycles
  that are not ours to break. Nothing outside it has one, and the rule keeps it that way.
- **Duplicate imports use `import/no-duplicates`, not eslint's `no-duplicate-imports`.** The
  eslint rule also merges `import type { X }` into `import { y }`, which fights how most of
  this codebase is written; the import plugin's version only flags real value duplicates.
- **`no-unused-vars` gives no coverage in `<script setup>`.** A top-level binding is exposed to
  the template, oxlint does not read templates, so it cannot tell used from unused. `vue-tsc`
  builds a render function and does — which is why `noUnusedLocals` matters more here than the
  lint rule.

## The design system is the source of truth

`.claude/skills/design-system/` holds the visual and verbal rules, and they are findings from
member testing rather than preferences: warm paper, one accent, hairlines instead of boxes,
sparse radii, **nothing at rest casts a shadow**, no emoji, no exclamation marks, sentence
case, informal *Du*, and every number gets a noun ("3 neu", never a bare badge). Read it
before adding a surface.

Where shadcn's defaults contradict it, the component is patched once rather than overridden at
each call site — `shadow-xs` is stripped from Input and the outline Button, `AvatarFallback`
carries `bg-avatar text-avatar-foreground` because shadcn's `bg-muted` is the rail colour, and
`DropdownMenuItem` and `DialogContent` carry the mobile rules below, `navigation-menu`'s
trigger style drops shadcn's filled pills for the design system's underline-and-ink pattern,
and `AccordionTrigger` shows `ChevronRight` shut and `ChevronDown` open instead of rotating a
single chevron, which is what the icon table asks for.
The `add` for it also re-inserted the googleapis.com font import into `main.css` — the check
above is not hypothetical.

**Keep it updated.** When the interface departs from what that document says — a new icon set,
a changed rule, a pattern it does not cover — change the document in the same piece of work.
A source of truth that lags the code stops being one, and the next person follows the stale
version. Its `readme.md` is the file to edit; the prototype components under `components/` and
`ui_kits/` are throwaway mockups and need not follow.

Icons are **Lucide at `stroke-width="1.5"`** — Lucide's default of 2 is heavier than anything
else on the page. They accompany a label rather than replacing it.

## shadcn-vue: the CLI will undo things

`npx shadcn-vue@latest add …` rewrites `src/assets/main.css` on **every** run: it replaces the
font import with its own, dropping Newsreader and IBM Plex Mono, and appends a duplicate
`@layer base` block. It also offers to overwrite components you have already patched.

After any `add`:

```bash
git diff src/assets/main.css   # expect no change; restore the font import if there is one
grep -c shadow-xs src/components/ui/button/index.ts src/components/ui/input/Input.vue  # expect 0
grep -c bg-avatar src/components/ui/avatar/AvatarFallback.vue                          # expect 1
grep -c min-h-11 src/components/ui/dropdown-menu/DropdownMenuItem.vue                  # expect 1
grep -c 'max-h-\[calc(100svh' src/components/ui/dialog/DialogContent.vue                # expect 1
grep -c max-w-lg src/components/ui/dialog/DialogContent.vue src/components/ui/dialog/DialogScrollContent.vue  # expect 0
grep -c 'optional?: boolean' src/components/ui/field/FieldLabel.vue                    # expect 1
grep -c min-h-11 src/components/ui/navigation-menu/index.ts                            # expect 1
grep -c '<ChevronRight' src/components/ui/accordion/AccordionTrigger.vue                # expect 1
```

Decline every overwrite prompt (`yes n | npx shadcn-vue@latest add …`).

**A string template ref does not compile here.** `CarouselContent` came with
`ref="carouselRef"`, which `noUnusedLocals` reads as the binding never being used — and binding
it instead does not work either, because a template unwraps a ref. It takes a function ref, which
is what `setViewport` is. Any generated component that attaches a ref by name needs the same
treatment.

**There are two dialog content components.** `DialogContent` centres and zooms; `DialogScrollContent`
scrolls the page behind a taller panel. Anything done to one belongs in the other — the close
button's tap target was fixed in one and missed in the other, and so was the width. Neither sets
a desktop width any more: each dialog picks one of the four named widths, so a `max-w-lg` back in
either file means the generator overwrote a patch.

**One dialog per subject, not one per verb.** `GroupDialog` and `StoryIdeaDialog` each found
*and* edit: an absent subject prop means creating. Two components for the two verbs shared about
three hundred and fifty lines and differed in six small ways — which is how `language` and the
optional markers each had to be added twice, once per file. A dialog that saves also **emits**
rather than navigates, because where to go afterwards belongs to the caller: the groups list
opens the new group, the group's own page stays put.

## The generated API client

`src/api/` is generated from `../backend/open-api.json` and **git-ignored**, so a fresh
checkout has none:

```bash
npm run open-api:generate-client
```

CI runs this before `validate:check`, and the production compose file runs it before
building. Regenerate whenever the backend's specification changes.

Three things about the generated code:

- **Orval classifies by HTTP method**, so the list endpoints — which use HTTP QUERY — would
  become mutations, with no caching, no query key and no fetch on mount. Each is declared as a
  query in `orval.config.ts` under `override.operations`. A new list endpoint needs the same
  entry.
- **The client resolves for every status and never throws**, which would make vue-query treat
  a 401 as a success. `src/lib/apiFetch.ts` is the mutator that throws `ApiError` instead. It
  lives outside `src/api/` because that directory is generated.
- **Every operation gets its own copy of each response model** (`LoginUser401`,
  `GetCurrentUser429`, …) and there is no shared error type, which is why `ApiErrorBody` is
  declared by hand.

Because responses are typed as a union over every declared status, narrow before use:

```ts
const group = computed<GetGroup200 | undefined>(() =>
  data.value?.status === 200 ? data.value.data : undefined,
)
```

**A list's key is a prefix of everything nested under it.** Orval builds keys from the URL's
segments, so `['QUERY','api','chats']` — what `listKeyPrefix` produces for the chat list — also
matches `['QUERY','api','chats',id,'messages',body]`. Invalidating the list therefore refetched
whichever conversation was open, one request per loaded page. `listOnlyFilter` adds the length
check that separates a list from its children, and every groups-list and chats-list
invalidation now uses it. Note it returns a whole **filter**, so it is passed as the argument —
`invalidateQueries(listOnlyFilter(key))`, never as a `queryKey`.

**Which helper depends on the method.** A QUERY key ends in the request body, so `listKeyPrefix`
drops that slot to match every page. A **GET** key has no body slot — `['api','groups',id,
'threads']` is the whole identity — so dropping its last segment leaves `['api','groups',id]`,
which matches that group's steps, memberships and thread details too. Invalidate a GET list with
its key as it is. `lib/api/__tests__/queryKeys.spec.ts` pins both behaviours, including that
trap.

**Numbered paging is `usePagedList` plus `ListPagination`**, not written again per view. The
composable owns the page number in the URL, the offset, the page count and the correction of an
out-of-range page; the component draws the strip. A view supplies the page size, the total, and
whatever else it keeps in the query — the thread's order toggle calls `navigate` so switching
order and returning to page one are *one* push rather than two history entries.

**Call it before the query it pages.** A request body needs `offset` while vue-query is building
the key, and the total it needs comes back from that same query, so one of the two consts is
always declared second. The composable therefore reads the total through a getter and registers
its correction watcher in `onMounted`, and views pass `() => total.value`. Getting this wrong
throws `Cannot access 'offset' before initialization` during setup, which renders an empty list
and no strip — it looks like a data problem, not an ordering one.

**A paged list keeps the previous page while the next loads.** `placeholderData: keepPreviousData`,
because a new page is a new query key and therefore briefly has no data: the page strip and the
count it is built from would blink out between every page. It also matters for correctness — a
watcher that corrects an out-of-range page must wait for the count to be *known*, or it reads the
momentary "0 results" as "page 1 is the last page" and sends the reader back on every click. That
bug shipped for about ten minutes and looked exactly like a dead button.

**The carousel walks by idea, never by position.** `useStoryIdeaCarousel` holds the loaded
ideas itself and asks `QUERY /story-ideas/carousel` about *an idea*, which answers with the two
either side of it. A page number in the URL would have been wrong within hours: the newest
idea comes first, so anything anybody posts shifts every position behind it, and a link would
have opened silently beside the idea it named rather than failing.

Three things about it, and the middle one is the whole design:

- **Two conditional queries, one endpoint.** The forward one asks about the *last* idea loaded
  whenever the reader is within a slide of it; the backward one only fires at the first slide.
  Without that lookahead the forward arrow goes dead for a round trip on every single step,
  because a ±1 answer cannot know the slide after next.
- **The track only grows, and one slide of it shows at a time.** `transform: translateX(-index
  * 100%)` on a flex row, with a 220ms transition. Appending leaves every index meaning what it
  did, so a loaded idea can join the track at any moment — including mid-transition, which
  cannot disturb it.
- **Prepending is the one thing to take account of.** It shifts every index, so the reader's
  moves by one while what is on screen must not: that change re-anchors rather than slides, and
  the transition is switched off for it in a `pre` watcher. Only happens after a reload
  part-way through the set.

**It is deliberately not a carousel component.** Embla was tried and removed. It measures the
DOM, and every hard bug here came from that: a re-measure destroys the animation it interrupts
and swallows the `settle` that would have followed, and `duration: undefined` — its option merge
copies every key it finds, `undefined` included — overwrote its own default and silently took the
branch that renders the last frame at once, so there was no animation at all in any browser. A
transform driven by an index measures nothing, and none of those failures are reachable. What the
component was actually providing was drag-following-the-finger, which is wrong for a page of
prose that scrolls vertically and can be selected — swipe and keyboard are deliberately not in
this version.

A CSS transition is also the only version of this that can be *verified* in the preview pane:
read the inline transform and the computed one in the same expression. The inline value is
already at the target while the computed one is still at the start, which is an animation in
flight. Embla's rAF loop could never show that, because the pane never fires rAF.
  resumes; but twenty steps must not mean twenty presses of the back button to leave, so the
  carousel uses `router.replace` while `usePagedList` keeps `push`. A page change is coarse and
  deliberate; a carousel step is continuous.

It is reached from the **Storyideen menu** in both bars rather than from a button on the board:
it is a way of reading the board, not an action on it, and `DESTINATIONS` is the one place either
bar learns about it. Its own page therefore carries no link back — the menu is already the way
between the three.

Marking an idea read there updates the one slide **and the count**, and invalidates only the
*board*. Invalidating the carousel's own query would rebuild the set around the reader and take
the idea they are looking at out of it — the same rule `NotificationsDialog` follows. The count
has to be carried by hand for a reason worth knowing: every key the walk has visited answers from
cache, so nothing refetches a fresh total and "noch 20 ungelesene" sat frozen for a whole session
of marking ideas read. Note that *both* states take an idea out of the set, since unread is the
absence of a row.

An anchor that is no longer part of the set — closed since, its author blocked, deleted —
answers 404, and the composable clears the anchor and starts at the newest rather than showing an error:
the link is out of date, not wrong. Clearing it is what lets the same query recover; a captured
constant would keep asking about the dead id forever.

**Cursor-paged endpoints are hand-written composables.** Orval's `useInfinite` substitutes a
query *parameter*, and these endpoints carry paging in a JSON body, so
`composables/useChatMessages.ts` calls the generated `listMessages` function from a
`useInfiniteQuery` of its own. It still keys off `getListMessagesQueryKey`, so invalidation
written against the generated key reaches it.

**Long prose is rendered as the paragraphs it was typed as.** `lib/format/paragraphs.ts` splits
on blank lines, and a post and a story idea's synopsis both use it — a single `<p>` renders eight
thousand characters as one wall, and a textarea is the only thing members have to mark a break
with.

## Sessions and routing

The session cookie is `httpOnly`, so `GET /api/auth/me` is the only way to know whether this
browser is signed in. The router guard resolves it through `src/lib/session.ts`, which caches
via vue-query so navigating between guarded routes costs no extra request. After signing in,
out or up, call `forgetCurrentUser()` before navigating or the guard will act on the stale
answer.

Routes need a session unless marked `meta: { guestOnly: true }`, which also bounces a
signed-in visitor away. A page that should be readable by everyone would need a flag of its
own.

The dev server proxies `/api` to `http://localhost:8000`, which keeps development
same-origin exactly like production behind Caddy: relative URLs, no CORS, and the cookie sent
without any credentials configuration. The proxy and the Caddy matcher are each a single rule
because the backend serves everything under `/api`.

## Dates

`src/lib/formatTime.ts` uses `Intl` only — `RelativeTimeFormat` already knows German plurals,
and swapping one `LOCALE` constant is most of what localising these strings takes. Do not
reach for a date library until times must be shown in a zone other than the reader's, or
differences must be counted in calendar days rather than elapsed milliseconds.

`Temporal` is not available: it exists in current Chrome but not in Node, so it would compile
and run in the browser while failing under vitest.

## Tests

Vitest, in `__tests__/` beside the code as `<module>.spec.ts` — this is what
`tsconfig.vitest.json` includes, and it differs from the backend's `_test.ts` convention.

```bash
npx vitest run
```

## What the automated browser cannot tell you

The browser these tools drive is not a fair witness for anything that moves. Three behaviours
were mistaken for bugs in it, and each was fine in a real browser:

- **`requestAnimationFrame` never fires** while the pane is hidden, and it is hidden except
  during a screenshot. Anything animated in JavaScript rather than CSS — embla's whole engine —
  therefore moves in bursts or not at all, and cannot be measured there. Sampling a transform
  over rAF simply hangs.
- **Scroll events never fire** — not for a programmatic scroll, not for a listener you attach
  yourself. Anything driven by `@scroll` looks dead there.
- **Smooth scrolling is a no-op**, whether asked for as `behavior: 'smooth'` or as CSS
  `scroll-behavior`, and the latter swallows a plain `scrollLeft` assignment with it.
- **CSS animations freeze at their first keyframe** while the pane is hidden, so a measured
  rect can be mid-animation: read computed styles instead, or measure at rest.

So verify structure and position there — is the element in the DOM, did `scrollLeft` change, is
the target 44px — and treat "the animation did not play" or "the event did not fire" as unproven
rather than broken. Ask for a real browser when the behaviour *is* the movement.

## Mobile is not optional

The old platform had none, and that was a top complaint. Every target is at least 44px on a
phone (`h-11 md:h-9` on controls, `min-h-11 md:min-h-0` where the height is intrinsic), the
reading size never shrinks below 17px, and the composer starts collapsed. Check 375px before
calling a surface done, and 375×667 for anything in a dialog — that is where content outgrows
the screen first.

Reach for the component before a raw `<button>`: `sm` and `default` both carry
`min-h-11 md:min-h-0`, so anything hand-rolled has to repeat that rule and will be missed when
the next component-wide fix lands. A raw button is still right for things that are not
button-shaped — rail strips, list rows, tabs that share a baseline — and those carry the rule
themselves. A blanket `button { min-height }` in the base layer is *not* the answer, unlike the
`cursor: pointer` rule there: a cursor changes no layout and a min-height changes plenty.

**Navigation is a bottom bar below `md`.** `BottomBar.vue` is a flex row of `AppLayout`, not a
fixed overlay — the layout is already a full-height flex column, so there is no content padding
to keep in step and nothing can cover the composer. `TopBar`'s nav is `hidden md:flex`.

**The right rail is a sheet below `lg`.** `AppLayout` moves `$slots.rail` between the `aside`
and `ContextSheet` on a media query rather than a CSS breakpoint, so the rail's contents mount
once; `hidden` would keep a second copy alive. Without the sheet the story status, the next
steps and the files had no route at all on a phone *or* a tablet.

## Where things live

`components/` is grouped by **domain**, not by kind: `group/`, `thread/`, `chat/`,
`notification/`, `search/`, plus `layout/` for the frame around a page, `common/` for pieces
with no subject of their own, and `context/` for the right rail. A dialog goes with its
subject — `GroupDialog` is in `group/`, `MessagesDialog` in `chat/` — because it changes
when groups or chats change, not when dialogs do. A `dialogs/` directory would only move the
problem down a level and put unrelated things side by side again. A directory holding one file
is better than a file in the wrong directory.

`composables/` holds every `use*`, which is also what `components.json` already declares.
`lib/` is grouped the same way: `api/`, `auth/`, `format/`, `validation/`, `notification/`.

Two things stay put at `lib/`'s root: `utils.ts`, because `components.json` pins
`"utils": "@/lib/utils"` and forty-odd generated components import it — moving it breaks them
and every future `shadcn add`; and `assertUnreachable.ts`, which belongs to no domain.

`components/ui/` is generated territory and is not reorganised.

## Components built on reka-ui

`components/ui/` is generated territory — shadcn-vue writes there, and a hand-written file
could be overwritten by the next `add`. Anything we build ourselves goes in `components/`,
named for what it does (`SearchField`, `SearchResults`) rather than the primitive it wraps.

Reaching for reka directly is not a departure: shadcn-vue is a generator rather than a
dependency, and reka is what all forty-odd `ui/` components already stand on. Match their
conventions when you do it — `cn()` for class merging, a `data-slot` attribute, `class?:
HTMLAttributes['class']` as a prop — so the result does not read as foreign. Let reka position
its own floating content; an `absolute` of our own fights it and sends the popover off-screen.

## Exhaustive switches

`lib/assertUnreachable.ts` in the `default` branch of any `switch` over a union. It is a
duplicate of the backend's `util/assert_unreachable.ts` — the two projects share no code, and
four lines twice costs less than a build-time dependency between them.

## Notifications

`lib/notificationText.ts` writes the sentence; the API returns the event and the joined
titles, never a rendered string. That is what lets a renamed group read correctly in an old
notification, and why nothing survives the reader losing access to what it is about.

`NotificationsDialog` marks everything read on open and then invalidates **only** the
current-user query, never its own list. That clears the mark on the avatar while leaving the
dialog showing what was new when it was opened; refetching would mark them read in front of
the reader. Its query is `enabled` on the dialog being open — it lives in the top bar on every
page, and a list nobody is looking at is not worth fetching.

Personal features are dialogs opened from the avatar menu rather than routes, so they do not
take a member off the page they are on.

## Length limits

Never write a bound as a literal. `src/api/textLimit.ts` is generated from
`backend/open-api.json` by `scripts/generateTextLimit.ts` as part of
`npm run open-api:generate-client`, keyed by operation and request-body property:
`TEXT_LIMIT.registerUser.username.maxLength`. It lives in the gitignored `src/api/`, so it is
rebuilt from the document every time and cannot go stale.

The generator is TypeScript run by Node's own type stripping — `node scripts/…​.ts`, no build
step and no runner. Stripping erases types without checking them, so `tsconfig.node.json`
includes `scripts/**/*` to put the file under `vue-tsc --build`, and sets `erasableSyntaxOnly`
so syntax stripping cannot handle (`enum`, `namespace`, parameter properties) fails the type
check rather than the run. The numbers originate in
`backend/src/text_limit.ts`.

Short fields — names, titles, addresses, a search term — bind them straight to `minlength` and
`maxlength`, and let `fieldMessage()` in `lib/fieldMessage.ts` phrase what the browser found
wrong. It exists because the fallback wording was actively misleading: an over-long username
used to report "Gib einen Benutzernamen ein." beside the name just typed.

**Prose fields take no `maxlength`.** A group description and a post body are checked on submit
instead, and the draft is left untouched. Typing that stops dead mid-word with no explanation is
the opposite of what the research asked for, and a live "97.500 / 100.000" is worse still — word
counters were rejected outright as pressure. Say what the limit is once, at the moment it
matters. Interpolate limits through `formatCount()` so they read as German (100.000, not 100000).
