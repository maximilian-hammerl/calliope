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
each call site — `shadow-xs` is already stripped from Input and the outline Button.

## shadcn-vue: the CLI will undo things

`npx shadcn-vue@latest add …` rewrites `src/assets/main.css` on **every** run: it replaces the
font import with its own, dropping Newsreader and IBM Plex Mono, and appends a duplicate
`@layer base` block. It also offers to overwrite components you have already patched.

After any `add`:

```bash
git diff src/assets/main.css   # expect no change; restore the font import if there is one
grep -c shadow-xs src/components/ui/button/index.ts src/components/ui/input/Input.vue  # expect 0
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
phone (`h-11 md:h-9` on controls), the reading size never shrinks below 17px, and both rails
are hidden rather than shrunk. Check 375px before calling a surface done.
