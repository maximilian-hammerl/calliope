# Frontend

Vue 3 with Vite, Tailwind v4, shadcn-vue, TanStack vue-query and an Orval-generated API
client. Linted by `oxlint`, formatted by `oxfmt`. Tasks are `npm run …` — see the root
[AGENTS.md](../AGENTS.md) for the conventions shared with the other projects.

- **File names are `camelCase`**, except when the file is a class or a component, which are
  `PascalCase`: `formatTime.ts`, `useGroupRole.ts`, `AppLayout.vue`.
- **Imports use the `@/` alias**, which points at `src/`: `@/lib/formatTime`.
- **Annotate every `ref` and `computed`**: `ref<string>('')`,
  `computed<GetGroup200 | undefined>(…)`.
- **Route paths are English, everything a member reads is German**: `/groups/:groupId`
  renders "Meine Gruppen".

## The design system is the source of truth

`.claude/skills/design-system/` holds the visual and verbal rules, and they are findings from
member testing rather than preferences: warm paper, one accent, hairlines instead of boxes,
sparse radii, **nothing at rest casts a shadow**, no emoji, no exclamation marks, sentence
case, informal *Du*, and every number gets a noun ("3 neu", never a bare badge). Read it
before adding a surface.

Where shadcn's defaults contradict it, the component is patched once rather than overridden at
each call site — `shadow-xs` is stripped from Input and the outline Button, `AvatarFallback`
carries `bg-avatar text-avatar-foreground` because shadcn's `bg-muted` is the rail colour, and
`DropdownMenuItem` and `DialogContent` carry the mobile rules below.

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
```

Decline every overwrite prompt (`yes n | npx shadcn-vue@latest add …`).

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

## Mobile is not optional

The old platform had none, and that was a top complaint. Every target is at least 44px on a
phone (`h-11 md:h-9` on controls, `min-h-11 md:min-h-0` where the height is intrinsic), the
reading size never shrinks below 17px, and the composer starts collapsed. Check 375px before
calling a surface done, and 375×667 for anything in a dialog — that is where content outgrows
the screen first.

**The right rail is a sheet below `lg`.** `AppLayout` moves `$slots.rail` between the `aside`
and `ContextSheet` on a media query rather than a CSS breakpoint, so the rail's contents mount
once; `hidden` would keep a second copy alive. Without the sheet the story status, the next
steps and the files had no route at all on a phone *or* a tablet.

## Where things live

`components/` is grouped by **domain**, not by kind: `group/`, `thread/`, `chat/`,
`notification/`, `search/`, plus `layout/` for the frame around a page, `common/` for pieces
with no subject of their own, and `context/` for the right rail. A dialog goes with its
subject — `CreateGroupDialog` is in `group/`, `MessagesDialog` in `chat/` — because it changes
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
take a member off the page they are on. `PlaceholderDialog` stands in for the ones that do not
exist yet and says so plainly.

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
