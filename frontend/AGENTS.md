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
each call site — the Button's `outline` **is** the design system's Quiet level (`bg-paper-3`,
`border-line-5`, `text-oak-deep`, 500) and its `secondary` variant is deleted rather than left as
a borderless near-twin, **every control is `rounded-lg`** because 6px is the control radius — Button,
Input, Textarea and SelectTrigger, which shadcn ships at four — `shadow-xs` is stripped from all
four because nothing at rest casts a shadow, `Spinner` is `size-3.5` rather than shadcn's
`size-4` so it matches the icons and the text it sits beside, **Input and SelectTrigger carry `min-h-11 md:min-h-0`**
so the 44px phone target is not written out at each call site (it was, at 39 of them), `AvatarFallback`
carries `bg-avatar text-avatar-foreground` because shadcn's `bg-muted` is the rail colour, and
`DropdownMenuItem` and `DialogContent` carry the mobile rules below, `navigation-menu`'s
trigger style drops shadcn's filled pills for the design system's underline-and-ink pattern,
and `AccordionTrigger` shows `ChevronRight` shut and `ChevronDown` open instead of rotating a
single chevron, which is what the icon table asks for. The `add` for it also re-inserted the
googleapis.com font import into `main.css` — the check above is not hypothetical.

`popover/` is patched the same way: the control radius, and shadcn's `shadow-md` dropped.

`AvatarImage` carries **`object-cover`**, which shadcn leaves off: an `<img>` defaults to `fill`,
so a portrait photograph is stretched into the square rather than cropped to it. The upload
centre-crops identically, which is what lets a preview of a chosen file show what will be stored.

`radio-group` and `checkbox` were patched together and belong together: both take the
`border-line-5` hairline, both fill with oak when chosen, neither casts a shadow, and the 44px
phone target is the wrapping label's rather than the 16px box's — a dot that size is not a tap
target, and making it one would look like a mistake.

`pagination` needed four of the same kind: the current page is an underline rather than a filled
chip, the numbers and the two arrows carry the 44px phone target, „Zurück" and „Weiter" replace
shadcn's English **and** its `hidden sm:block`. Hiding them buys nothing: measured at 320, 375 and
414px, at six pages and at thirty, the strip is two rows and 92px either way — the 44px numbers
are what wrap it, not the words. `PaginationFirst` and `PaginationLast` are deleted: `showEdges`
draws the first and last *numbers*, so nothing rendered them, and they would have sat in `ui/`
failing the icon check below.

**Every icon shadcn hardcodes is `aria-hidden`**, because not one of them says anything the
markup around it has not said already: the chevrons in `AccordionTrigger` (both), `SelectTrigger`,
the two `SelectScroll*Button`s, `DropdownMenuSubTrigger` and `NavigationMenuTrigger` are
affordances next to an `aria-expanded`; the `Check` and `Circle` in `SelectItem` and the two
`DropdownMenu*Item`s sit inside a reka `*ItemIndicator` that only renders when the item's own
`aria-selected` or `aria-checked` is already true; and the dialogs' `X` sits beside the `sr-only`
label that names the button. An icon that duplicates state is read twice by a screen reader and
adds nothing the second time.

**Both dialogs' close buttons say „Schließen".** shadcn ships `<span class="sr-only">Close</span>`,
which is English in an interface that is German everywhere a member can read — and `sr-only` is
exactly why it survived a year of looking at these dialogs. `ContextSheet` had it right with
`aria-label`. Anything visible only to a screen reader still gets read, so it is still copy.

**Keep it updated.** When the interface departs from what that document says — a new icon set,
a changed rule, a pattern it does not cover — change the document in the same piece of work.
A source of truth that lags the code stops being one, and the next person follows the stale
version. Its `readme.md` is the file to edit; the prototype components under `components/` and
`ui_kits/` are throwaway mockups and need not follow.

**Type comes from the named scale**, never a literal: `text-body`, `text-note`, `text-nav`,
`text-row`, `text-control`, `text-rail`, `text-h1`, `text-h2`, `text-h3`, declared in `theme.css`. Each sets
the size *and* the line height, which is the point — writing the pair by hand is how 13.5px ended
up with four different line heights.

A new size goes in `FONT_SIZES` in `lib/utils.ts` as well as `theme.css`. tailwind-merge reads
`text-*` and guesses — t-shirt size means size, anything else means colour — so an undeclared
`text-note` is filed under colour, and `cn('text-note text-ink-5', …)` merges the two and drops
the size. A test compares the two lists, because the failure is silent.

**A block of prose gets a class, not a class per tag.** `styles/prose.css` holds `.prose-post`
for a member's writing and `.prose-legal` for the legal pages, whose forty paragraphs would
otherwise each repeat the same three utilities. `base.css` stays element and role defaults.

**Spacing is Tailwind's scale**, which already covers the design system's 2px steps — `1.5` is
6px, `3.5` is 14px. Two exceptions: `px-gutter` (18px, the phone gutter, paired with `md:px-10`),
and a bracketed value like `pb-[11px]`, which means deliberately off the scale — an optical
alignment. Do not convert those to fractional steps; the bracket is the signal.

Icons are **Lucide at `stroke-width="1.5"`** — Lucide's default of 2 is heavier than anything
else on the page. They accompany a label rather than replacing it.

## shadcn-vue: the CLI will undo things

**Use the CLI anyway.** Everything below is a list of things it gets wrong, which makes it read
like an argument for avoiding it. It is not. A shadcn component is what the CLI writes, and this
project is committed to that: the alternative is hand-writing the file, and a hand-written copy
is worse in the way that matters, because it is a copy of what you *remember* the component
being. A replicated popover came out missing `inheritAttrs: false`, the `$attrs` spread, the
root's `v-slot` forwarding and `max-w-(--reka-popover-content-available-width)` — four silent
behaviour differences, against two house patches that the checklist reapplies in a minute. Run
`add`, restore what the checklist names, reapply the patches. The damage is bounded and written
down; the drift from copying by hand is neither.

The same holds for reaching past a component to reka. That is right when what you are building
is not the component — `SearchField` and `ContextSheet` both say so in a docblock, and both
build something the generator does not ship. It is wrong when the thing you want *is* the
component and the CLI is merely inconvenient.

`npx shadcn-vue@latest add …` rewrites `src/assets/main.css` on **every** run: it replaces the
font import with its own, dropping Newsreader and IBM Plex Mono, and appends a duplicate
`@layer base` block. It also puts a `^` back on every dependency it touches — `@lucide/vue`,
`@vueuse/core` and `reka-ui` were already installed and pinned, and it re-ranged all three — and
offers to overwrite components you have already patched.

After any `add`:

```bash
git diff src/assets/main.css   # expect no change; restore the font import if there is one
# The CLI re-ranges pinned dependencies. `engines.node` is the one legitimate range.
grep '"\^' package.json | grep -v '"node"'                                            # expect no output
# Every shadow, not only shadow-xs: `shadow-md` on the menu and select panels survived a
# year of this check because it only ever looked for one class name. Dialog keeps its own.
grep -rl 'shadow-' src/components/ui/ | grep -v dialog                                 # expect no output
grep -rl 'rounded-md' src/components/ui/dropdown-menu/ src/components/ui/select/ src/components/ui/popover/  # expect no output
grep -c border-line-5 src/components/ui/button/index.ts                                # expect 1
grep -c secondary src/components/ui/button/index.ts                                    # expect 0
grep -c rounded-md src/components/ui/button/index.ts src/components/ui/input/Input.vue src/components/ui/textarea/Textarea.vue src/components/ui/select/SelectTrigger.vue  # expect 0
grep -c min-h-11 src/components/ui/input/Input.vue src/components/ui/select/SelectTrigger.vue  # expect 1 each
grep -c 'size-3.5' src/components/ui/spinner/Spinner.vue                               # expect 1
grep -c bg-avatar src/components/ui/avatar/AvatarFallback.vue                          # expect 1
grep -c min-h-11 src/components/ui/dropdown-menu/DropdownMenuItem.vue                  # expect 1
grep -c 'max-h-\[calc(100svh' src/components/ui/dialog/DialogContent.vue                # expect 1
grep -c max-w-lg src/components/ui/dialog/DialogContent.vue src/components/ui/dialog/DialogScrollContent.vue  # expect 0
grep -c 'optional?: boolean' src/components/ui/field/FieldLabel.vue                    # expect 1
grep -c 'role="group"' src/components/ui/field/Field.vue                               # expect 0
grep -c min-h-11 src/components/ui/navigation-menu/index.ts                            # expect 1
grep -c '<ChevronRight' src/components/ui/accordion/AccordionTrigger.vue                # expect 1
grep -c aria-hidden src/components/ui/accordion/AccordionTrigger.vue                    # expect 2
# Without this every trigger renders aria-controls="" — see the accordion note below.
grep -c injectCollapsibleRootContext src/components/ui/accordion/AccordionTrigger.vue   # expect 2
# The radio and the checkbox share the hairline and the oak, so they read as one family.
grep -c border-line-5 src/components/ui/radio-group/RadioGroupItem.vue src/components/ui/checkbox/Checkbox.vue  # expect 1 each
grep -c 'data-\[state=checked\]:bg-oak' src/components/ui/checkbox/Checkbox.vue         # expect 1
grep -c fill-oak src/components/ui/radio-group/RadioGroupItem.vue                       # expect 1
# Without this an avatar stretches a portrait photograph instead of cropping it.
grep -c object-cover src/components/ui/avatar/AvatarImage.vue                           # expect 1
grep -c 'border-b-2' src/components/ui/pagination/PaginationItem.vue                   # expect 1
grep -c min-h-11 src/components/ui/pagination/PaginationItem.vue src/components/ui/pagination/PaginationPrevious.vue src/components/ui/pagination/PaginationNext.vue  # expect 1 each
grep -rc 'hidden sm:block' src/components/ui/pagination/                               # expect 0
ls src/components/ui/pagination/PaginationFirst.vue src/components/ui/pagination/PaginationLast.vue  # expect neither to exist
grep -c 'sr-only">Schließen' src/components/ui/dialog/DialogContent.vue src/components/ui/dialog/DialogScrollContent.vue  # expect 1 each
# Without this the dialog root renders id="", which is invalid — see the ids section.
grep -c 'id: contentId' src/components/ui/dialog/DialogContent.vue src/components/ui/dialog/DialogScrollContent.vue  # expect 1 each
# Every icon in ui/ is hidden or named — Spinner is the only named one. Expect no output.
grep -rL 'aria-hidden\|aria-label' $(grep -rl '@lucide/vue' src/components/ui/ --include='*.vue')
```

Decline every overwrite prompt (`yes n | npx shadcn-vue@latest add …`).

**The accordion trigger claims its content's id.** reka's `CollapsibleRoot` starts `contentId`
empty and `CollapsibleContent` fills it in *as it renders* — but the trigger renders first, so
`aria-controls` came out `""`: an IDREF pointing at nothing, on every accordion in the app.
`AccordionTrigger` now claims the id before it paints and the content keeps it (`||=`). Same cause
and same shape as `DialogContent`'s `contentId`, which is the other place reka fills an id in too
late.

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

CI runs this before `validate:check`, and the deploy compose file runs it before
building. Regenerate whenever the backend's specification changes.

Three things about the generated code:

- **Orval classifies by HTTP method**, so the list endpoints — which use HTTP QUERY — would
  become mutations, with no caching, no query key and no fetch on mount. Each is declared as a
  query in `orval.config.ts` under `override.operations`. A new list endpoint needs the same
  entry.
- **The client resolves for every status and never throws**, which would make vue-query treat
  a 401 as a success. `src/lib/api/apiFetch.ts` is the mutator that throws `ApiError` instead. It
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
out-of-range page; the component draws the strip — as a thin wrapper over reka's `Pagination`,
whose `siblingCount` and `showEdges` replaced a hand-written run of page numbers.

**Its props are reka's — `page`, `total`, `itemsPerPage`** — rather than a vocabulary of our own
left over from the component it replaced. The composable returns all three, and a view passes them
straight through: they are then the same numbers the `offset` was computed from, where a view
supplying its own `total` and page size would be free to supply a different pair and page twice.
`v-model:page` works because the composable's `page` is writable, its setter being `goToPage`.

Reka widens the run near either end — page 1 of 30 is `1 2 3 4 5 … 30` where the hand-written strip
gave `1 2 … 30`. It still wraps to two rows at 375px, the same as before, so the widening is kept.

A view supplies the page size and the total, plus whatever else it keeps in the query — the
thread's order toggle calls `navigate` so switching order and returning to page one are *one* push
rather than two history entries.

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

**Long prose is rendered as the paragraphs it was typed as.** `lib/format/formatText.ts` splits
on blank lines, and a post and a story idea's synopsis both use it — a single `<p>` renders eight
thousand characters as one wall, and a textarea is the only thing members have to mark a break
with.

**A 401 is only a lost session when the API says so.** The wrong-password answer carries
`code: "invalid_credentials"`; anything else without a code is a session that has ended, and only
that signs the member out. The value comes from the generated client, so renaming it in the
backend breaks compilation here rather than behaviour.

Two exceptions stay named in `queryClient.ts`, each with its reason: the guard's own session
check, whose 401 *is* its answer, and `logoutUser`, where the session being gone is what was
asked for. There used to be a list of six operations, which is the shape that let `changePassword`
be forgotten.

## Sessions and routing

The session cookie is `httpOnly`, so `GET /api/auth/me` is the only way to know whether this
browser is signed in. The router guard resolves it through `src/lib/session.ts`, which caches
via vue-query so navigating between guarded routes costs no extra request. After signing in,
out or up, call `forgetCurrentUser()` before navigating or the guard will act on the stale
answer.

`SessionsSection` lists the member's own sessions, and **the API sends the parts of a user
agent, never a label**: `lib/format/sessionDevice.ts` writes "Safari auf iOS · Apple Handy" out
of `browser`, `operatingSystem`, `deviceType` and `vendor`. Same rule as `notificationText.ts`
below — a sentence stored or composed in the backend can only be in one language, and every
part of it may be null for a client the parser cannot read.

The brand is there because **"iOS" identifies nothing to a member who knows Apple**, which is
also why `deviceType` is translated ("Handy", "Tablet") while the brand is printed as it comes.
A kind with no German word is left off rather than guessed at.

**A route says who may open it with one `meta.access` value**, never a set of booleans: separate
flags let a route claim to be both guests-only and open to everyone, which means nothing and which
nothing would catch. `member` (the default when omitted, so a forgotten route locks rather than
leaks), `guest` which bounces a signed-in visitor away, `operator`, and `anyone` for a page that
must be readable either way — the mailed-link landing pages, and anything legal. The guard
switches over it with `assertUnreachable`, so a fifth kind cannot be added without handling it.

Verification is orthogonal: `access` asks whether there is a session, and the unverified-address
redirect asks what state that session's account is in.

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
- **Floating content will not close while the pane is hidden.** A reka `Select` opens, shows the
  right options, and then swallows every attempt to pick one — pointer, `Escape` and keyboard
  alike — so the trigger reports a value the component never received. `tabs_select` to front the
  pane first and it behaves; a selection that "does not take" is the pane, not the component.

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

**The right rail is a sheet below `lg`.** `GroupLayout` chooses between the `aside`s and
`ContextSheet` on a media query rather than a CSS breakpoint, so the rail's contents mount once;
`hidden` would keep a second copy alive. Without the sheet the story status, the next steps and
the files had no route at all on a phone *or* a tablet.

## The frame is mounted once

`App.vue` wraps the router view in `AppLayout`, and **no page renders its own**. Each of the
twelve views used to, which meant every navigation destroyed the whole frame and built it again:
the bars, and with them `ChatsDialog`, which owns both the chat list *and* the `EventSource`. So
each navigation closed the stream and opened a new one, `connected` went false and back to true,
and the watcher on it refetched the list — an explicit refetch, which `staleTime` does not bound.
Measured on the deployed instance: 39 stream opens in twelve minutes where there should be one,
and `/api/chats` the busiest endpoint in the log.

`AppLayout` therefore knows nothing but the bars and the body between them. Anything a group's
pages share belongs to **`GroupLayout`**, the parent route of `/groups/:groupId` — the group's
own query, the reader's permissions, both rails and the sheet. Its children read those through
`useGroupContext()` rather than fetching again; before it, three views each ran `useGetGroup` and
`useListMemberships` and each wrote its own `mayWrite`, in two different shapes.

Two consequences worth knowing. A rail's collapsed state now outlives a navigation, which is what
the design system's "reading mode" always meant and never did. And `GroupLayout` is **reused**
when only `:groupId` changes, so nothing in it may read the parameter at mount — `groupId` is a
computed, and every query takes it as one.

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

**`format/` is split by what the value is**, not by which component needed it: a time, a number,
prose, a name, a device. `pluralize` sat in `formatTime.ts` for months because its first two
callers already imported that file for "zuletzt aktiv" on the same line — which is how a module
ends up holding something that has nothing to do with its name.

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

## An id belongs to the instance, not to the label

`useId()` wherever a component can be on screen more than once — which is most components, since
a dialog can open over the page that already renders one. `FilterStrip` derived its id from its
label, so the chats dialog's „Favoriten" and the groups list's behind it shared one, and the
dialog's `aria-labelledby` named its group from the element outside the modal, which `aria-modal`
hides from the tree. Nothing about that is visible on screen.

`UserPicker` and `FormTextField` had the other shape of the same problem: the id arrived as a
**prop**, so uniqueness was the caller's job to remember across every call site. Both generate
their own now — `UserPicker`'s prop is gone, and `FormTextField`'s is optional, for the rare case
of something outside the component naming the input.

**A closed dialog keeps its content**, `data-state="closed"` and hidden, unless the call site also
gates it with `v-if`. So `ReportDialog`'s fixed `reportCategory` really was duplicated — `ThreadView`
mounts one for the post and one for the thread, and once each had been opened both sets of fields
were in the page, with every `<label for>` resolving to the first match: the hidden one. Do not
assume a dialog that is shut is gone.

A literal id is fine where a second instance is impossible — a routed view, a section that exists
once inside one dialog. That is why `login` and `password` may repeat across the sign-in views.
Nothing in `src/` looks an id up (`getElementById`, a `#` selector, a fragment), so no id here has
to be guessable — which is what makes the generated ones free.

## A member's picture

**`UserAvatar` takes an optional `avatarUrl` and falls back to the initial.** The fallback is a
sibling of `AvatarImage` rather than a `v-else`, because reka falls back on a *load failure* too —
so a file the sweep has collected shows a letter instead of a broken frame. Nothing builds the path:
the server sends it, so moving the route breaks compilation in one backend function rather than
every picture in the interface.

**The picture saves on its own, inside `ProfileDialog` but outside its form.** It is a multipart
body where the profile is a JSON patch of changed fields, and joining them would let one failure
discard the other's work.

**Saving or removing invalidates the current user as well as the profile.** The top bar reads its
own picture from `/auth/me`, so refreshing only the profile leaves the old face in the corner until
a reload — which is what happened before this line existed.

**The preview is the picture, not its filename.** Round, `object-cover`, at profile size — and
because the server centre-crops to a square, that is an honest preview of what will be stored, which
is most of what a crop step would have bought. shadcn's `Attachment` was considered and is the wrong
shape here: it is presentational only, with no file input at all, and shows metadata where the thing
itself is available. It would suit #31 and #95, which are lists of files.

**The declaration appears only once a file is chosen**, and the credit line only when the picture is
not the member's own. Asking everybody for a source is what turns a declaration into a field people
type „meins" into — see #29 on Yooco's required fields.

## Filters

**Every filter is a `FilterSection`** — its label, and its options behind a disclosure that starts
open. `FilterStrip` and the story vocabularies both render through it, and they did not before:
the label came out in the heading serif on one and the UI sans on the other, because reka wraps a
trigger in an `h3` and the base layer sets headings in Newsreader. One implementation is what
stops that recurring, so the overrides (`font-sans`, the explicit size) live there once.

Two things it takes: `initiallyShut` for a section long enough that opening it costs the page —
only the tropes, at thirty-one options and four rows — and `chosen`, a word shown beside the label
in darker ink. „3 gewählt" for a vocabulary, „aktiv" for a strip, and nothing at all when the
filter narrows nothing. A shut section has no other way to say it is still filtering, and a filter
that hides while it filters is how somebody concludes the board is empty. A strip needs its
`defaultValue` to know: something is always selected, so without it every strip would read as
narrowing. It is a word rather than the chosen option's own label because the label column is
shared — „Offen oder geschlossen · Geschlossen" would shift every other filter's options as it
changed.

A **hidden** label renders no disclosure at all: the two strips that use one are the view
switchers, which are navigation rather than filters and would have nothing visible to click.

**`FilterReset` belongs to the view, not to any one filter.** It lived inside the story
vocabularies and cleared only those, leaving the strips beside it set and the list still narrowed
after a member had asked for it not to be. The view says whether anything is active and what
cleared means — the defaults are its own — while the component owns the wording and the placement.
The search field is deliberately outside it: it is its own control, below the block, and clears
itself.

The open state is not remembered yet. Persisting it per member is what makes shut-by-default
worth having on a phone, and is the next thing to do here.

**`FilterStrip` lays out its own label** — beside the options from `md` up, above them below it.
It used to require its parent to be `md:grid md:grid-cols-[max-content_1fr]`, which is a rule the
call site cannot see and three of the five got wrong: the groups and discovery pages drifted for
months, and the thread's filter and the chats dialog's never had the grid at all, so their labels
sat above the strip on every desktop. A layout a component needs belongs inside it.

**`FilterStrips` wraps two or more**, and exists only for the shared label column that keeps their
options starting at the same place; separate grids would each size their own label and step
raggedly to the right. A single strip needs nothing around it. Which of the two a strip is in
reaches it by `provide`/`inject`, so neither the caller nor the strip has to be told twice.

## A status the whole interface must react to belongs in `queryClient`

Two of them do. 502/504 and a rejected fetch set `backendReachable`; a **429** sets
`rateLimitedUntil`. `App.vue` renders `ConnectionLost` or `RateLimited` from those, and neither is
a call site's problem: while either holds, *every* request is failing, so a message beside one
control would leave the rest of the interface failing in silence. A 401 is the third, and reaches
the router through `setSessionLostHandler`. Everything else stays local, because it means something
local — 400 field issues, 403 banned, 409 conflicts.

Three things about the rate limit in particular:

- **There are two budgets, so the notice says two different things.** The backend counts reads and
  writes separately, and the 429 body carries which one refused — so a spent write budget reads
  „Du kannst weiterlesen, aber gerade nichts speichern" over a page that genuinely still works,
  while a spent read budget is the one that takes the screen. Claiming the server is not answering
  while it answers every read would be a lie told over a working interface.
- **The wait comes from `Retry-After`.** The limiter runs `standardHeaders: "draft-7"` and the
  header counts down within the window rather than restating its length, so the notice says „in 4
  Minuten" instead of „später". `apiFetch` carries it on `ApiError`; it discarded the headers
  entirely before.
- **`RateLimited` does not probe, where `ConnectionLost` does.** Retrying is what caused this
  state. It counts down, offers its one button only once the window has passed, and the first
  answer after that clears it through `onSuccess`.
- **It sizes itself as the connection notice does, and that is also the fix for the navigation.** A
  limited member who reloads gets no session answer, so `AppLayout` renders no bars —
  `<TopBar v-if="user">` cannot tell a failed check from a signed-out one. Covering the screen says
  what happened rather than leaving them on a shell with no way off it.

**The wording lives in `lib/format/rateLimit.ts`.** Four sign-in views wrote their own sentence
before this and two had already drifted apart.

## An error a composable produces must have a renderer

Every `use*` that catches a failure and turns it into a German sentence — `useFavourite`,
`useStoryIdeaActions`, the settings forms — is producing something for a member to read. If no
component reads it, the failure is silent: the control re-enables, nothing changes, and it looks
like a dead button rather than a request that did not go through.

`useFavourite` shipped exactly that way. `favouriteError` was set on every failure and destructured
by none of its five call sites, so an offline member, a 429 from the limiter, or a 404 from a group
that went private in another tab all produced nothing at all on screen.

Two shapes, and which one to use depends on where the control sits:

- **A component used in more than one layout renders its own**, because delegating is what let this
  one go unshown. `FavouriteToggle` wraps its button and the message in an `inline-flex` box, which
  stays a single flex item in a row of buttons.
- **A form or a section uses `Alert variant="destructive"`** with `role="alert"`, which is what the
  settings sections, the dialogs and the composer already do. In a compact row a plain
  `text-destructive` paragraph with `role="alert"` is the quieter version — `StepList` and the
  story idea's `conversationError` both take that shape.

Whichever it is, the message is written once in the composable rather than at each call site, so
the wording cannot drift between the surfaces that share it.

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

## Favourites

One mark over five kinds. The wording lives in `lib/format/favourite.ts` — never write „Favorit" at
a call site; it was copied by hand once already.

- **`FavouriteToggle` emits its success and shows its own failure.** What to refetch belongs to the
  caller and differs; the message is the same sentence everywhere, and delegating it is how it went
  unshown. It renders inside an `inline-flex` box, so it stays one flex item in a row of buttons.
- **A post's row and the chat header use a raw button**, because those rows are text actions on one
  baseline rather than buttons — the same exception this file makes for rail strips and tabs. They
  still take their label from `favouriteToggle()`, and carry the 44px rule themselves.
- **`FilterStrip` on every list that shows a favouritable kind**, the idea board included on „Meine
  Storyideen", where the read and status filters are hidden: your own ideas cannot be unread.
- **`StateMark` owns the chrome; the four marks own an icon and a label.** The 13px size, the
  `mark` variant and the accessible name live in one place — these are the only icons here that are
  not `aria-hidden`, which is the part worth forgetting. `FavouriteMark`, `ReadMark`, `StatusMark`
  and `VisibilityMark` are a few lines each, and each reads its glyph and its word from a map in
  `lib/format/` so a row and a page cannot say one state two ways. The two that carry the thing's
  *own* fact — `StatusMark` and `VisibilityMark` — render both their states; the two that carry the
  *reader's* render one, because a reader's non-state is not a state. Page headings keep the word,
  which is what teaches the mark.
- **`interactive` makes a mark a popover trigger**, opt-in because a mark inside a search result or
  a chat row would be a button inside a link or a button. Its two open costs are written in the
  component: extra tab stops that tell a keyboard user nothing new, and a 37×33 target under the
  44px rule.
- **A mark is 25px where the word was 60**, which is why it exists: as a word it pushed the chats
  rail's unread count onto a second line, and the ten-tab strip and search popover could not carry
  it at all.
- **Marks are named, not hidden**: `aria-label` *and* `title`, since nothing else here is icon-only
  and hover is desktop-only.
- **`VisibilityMark` ships as an open question.** `Lock` and `LockOpen` are a shackle apart at 13px
  on the fact whose misreading costs most; the design system records what else was tried and what
  feedback would settle it.
- **`StoryIdeaDetail` renders the actions and has no slots.** Its two callers filled `#actions`
  themselves and drifted — a slot is where two callers disagree, so it is deleted rather than left
  as an override. What they still decide is emitted: the page refetches the idea, the carousel
  updates its slide via `setReadLocally` / `setFavouriteLocally` and invalidates only the board.
  Only *reading* moves an idea in or out of that set, so the favourite's version adjusts no total.
- **`lib/format/group.ts` holds both group vocabularies.** `MEMBERSHIP_LABELS` is for the search
  popover, which reaches past the groups the reader belongs to with nothing else saying so.

## Length limits

Never write a bound as a literal. `src/api/textLimit.ts` is generated from
`backend/open-api.json` by `scripts/generateTextLimit.ts` as part of
`npm run open-api:generate-client`, keyed by operation and request-body property:
`TEXT_LIMIT.registerUser.username.maxLength`. It lives in the gitignored `src/api/`, so it is
rebuilt from the document every time and cannot go stale.

**A union request body keeps its bounds in the branches.** `moveReport`'s is a `oneOf`, and the
generator reads every branch as well as the top level: reading only the top produced no bounds at
all for such an operation, silently, which is the one failure this file exists to prevent. A
property in more than one branch has to agree with itself — `note` is in both the reopening and the
closing — and branches that disagreed would make the number here a guess, so that throws instead.

The generator is TypeScript run by Node's own type stripping — `node scripts/…​.ts`, no build
step and no runner. Stripping erases types without checking them, so `tsconfig.node.json`
includes `scripts/**/*` to put the file under `vue-tsc --build`, and sets `erasableSyntaxOnly`
so syntax stripping cannot handle (`enum`, `namespace`, parameter properties) fails the type
check rather than the run. The numbers originate in
`backend/src/text_limit.ts`.

## Forms are Zod schemas over TanStack Form

Every form uses `useForm` from `@tanstack/vue-form` with **field-level validators**, which is the
documented Vue pattern and the one that lets a rule be shared. Validation used to read the inputs'
own `ValidityState` and look the wording up; that was eight copies of one loop and the wording was
duplicated with it — „Das Passwort darf höchstens 256 Zeichen lang sein." was written out seven
times.

- **A field's rules live once, in `lib/validation/fieldSchemas.ts`.** `usernameSchema`,
  `emailAddressSchema`, `passwordSchema`, `loginSchema`, `titleSchema`, `proseSchema`,
  `httpUrlSchema`. Each takes the **calling operation's own**
  bound from `TEXT_LIMIT` — never one operation's numbers used for another — and the wording for an
  *empty* field, because that names what is being asked for: „Wähle ein Passwort" when registering,
  „Gib dein aktuelles Passwort ein" when confirming who you are. The length and format wording is
  the same everywhere and is declared in the factory.
- **Rules are written in the order a member should read them.** Zod collects *every* failing check
  and keeps them in declaration order, and `firstError()` shows the first — so `.min(1, missing)`
  before `.min(3, tooShort)` is what makes an empty username say "enter one" rather than "needs
  three characters". That order is the interface's, not an implementation detail.
- **The email rule is the backend's rule.** `z.regexes.html5Email`, the same constant
  `EMAIL_ADDRESS_SCHEMA` uses, so the form and the API cannot disagree about what an address is.
  `type="email"` stays on the input for the keyboard it summons on a phone, not for validation.
- **`maxlength` stays on the input** because it stops the typing; the schema cannot. Everything
  else about the constraint lives in the schema.
- **One field is one `FormTextField`** (`components/common/FormTextField.vue`). It carries
  `aria-invalid`, `data-invalid`, the change handler, the error, and — the part easy to forget —
  **`aria-describedby`**, without which a field says *that* it is wrong and never *why*. Written
  per field that was sixty-four repetitions and a hand-made id on each one. It generates that id
  now — `id` is a prop only for the rare case of something outside naming the input — so nothing
  has to invent a unique word per call site, which is what `settingsCurrentPassword` was.
  Prose uses the same wrapper with `multiline`, and the chat row with `label-hidden` — a field
  that swaps its control or hides its label is still one field, and wiring it by hand is how
  `aria-describedby` goes missing.
- **A failed submit moves focus to the first marked field**, through `onSubmitInvalid` and
  `focusFirstInvalid()`. Otherwise focus stays on the button that was just pressed.
- **A 400 is schema drift, not a field problem.** Since the client enforces every rule the API
  does, a refusal on the shape means the deployed two disagree — so `failureMessage()` says to
  reload, and no form maps server issues onto fields any more. It never used the server's message
  anyway: it took the field from `issue.path` and showed that field's generic wording. A **401 or
  409 is different** and stays on the field it is about, set through `setFieldMeta`.

Prefer `failureMessage(error)` over a hand-written fallback: it already answers 429 with the wait
the server named and 400 with the reload sentence. Pass a second argument only where the control
names what failed („Die Anmeldung ist gerade nicht möglich").

**Prose fields take no `maxlength`.** A group description and a post body are checked on submit
instead, and the draft is left untouched. Typing that stops dead mid-word with no explanation is
the opposite of what the research asked for, and a live "97.500 / 100.000" is worse still — word
counters were rejected outright as pressure. Say what the limit is once, at the moment it
matters. Interpolate limits through `formatCount()` so they read as German (100.000, not 100000).
