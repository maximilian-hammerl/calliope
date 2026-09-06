# Frontend

Vue 3, Vite, Tailwind v4, shadcn-vue over reka-ui, TanStack vue-query and vue-form, an
Orval-generated client. Linted by `oxlint`, formatted by `oxfmt`, tested with Vitest. The shared
conventions are in the root [AGENTS.md](../AGENTS.md); the reasoning behind each area is in
`.claude/rules/frontend/`, which loads when you open that area's files.

```bash
npm run dev                          # Vite, proxying /api to the backend's port from .env
npm run open-api:generate-client     # src/api/ is git-ignored: run this on a fresh checkout and after
                                     # every backend route change; also regenerates src/api/textLimit.ts
npm run validate:check               # format, lint, type-check, knip  (validate:fix repairs what it can)
npx vitest run                       # __tests__/<module>.spec.ts beside the code
```

Two skills sit in `.claude/skills/`: **design-system**, the visual and verbal rules from member
research — read its `readme.md` before adding a surface, and change it in the same commit when the
interface departs from it; and **shadcn-vue**, the component CLI.

## Conventions

- **File names are `camelCase`**; components and classes are `PascalCase`. `@/` points at `src/`.
- **Annotate every `ref` and `computed`**: `ref<string>('')`, `computed<GetGroup200 | undefined>(…)`.
- **Route paths are English, everything a member reads is German**, informal *Du*, sentence case,
  no emoji, no exclamation marks, and every number gets a noun („3 neu", never a bare badge).
- **Navigate through `useRouter()`, never `$router`**, from a named handler so the promise can be
  `void`ed.
- **A type-only import is its own statement**: `import type { Ref } from 'vue'` above
  `import { computed } from 'vue'`, never `import { computed, type Ref }`.
- **A `switch` over a union ends in `default: return assertUnreachable(value)`.**
- **`useId()` wherever a component can be on screen more than once** — a dialog opens over a page
  that already renders one. A literal id is fine in a routed view. **A closed dialog keeps its
  content** unless the call site gates it with `v-if`.
- `noUnusedLocals` is the unused-binding check that matters: oxlint cannot see the template.
- **Dates use `Intl` only** (`lib/format/formatTime.ts`). `Temporal` exists in Chrome but not in
  Node, so it compiles, runs in the browser and fails under vitest; the backend has it, this side
  does not.

## The design system, in the rules you apply every day

- **Type comes from the named scale** — `text-body`, `text-note`, `text-h2`, … — never a literal
  size. A new size goes in `FONT_SIZES` in `lib/utils.ts` as well as `theme.css`, or tailwind-merge
  files it under colour and `cn()` drops it. A block of prose gets one class from `src/assets/styles/prose.css`.
- **Spacing is Tailwind's scale.** `px-gutter` is the phone gutter; a bracketed value like
  `pb-[11px]` means deliberately off the scale — do not convert it.
- **Icons are Lucide at `stroke-width="1.5"`**, `aria-hidden`, beside a label; no act is icon-only.
  The five `*Mark` components are the exception and carry `aria-label` and `title`.
- **Nothing at rest casts a shadow**; every control is `rounded-lg`.
- **Every tap target is 44px on a phone** — `min-h-11 md:min-h-0` on the element that takes the
  tap, not on the row around it. Reach for the component (`Button`, `Input` carry it) before a raw
  `<button>`. Check 375px before calling a surface done, 375×667 for a dialog.
- **Wording lives in `lib/format/`**, once — never write „Favorit" or a rate-limit sentence at a
  call site.

## The generated client

`src/api/` is generated and git-ignored. **Orval classifies by HTTP method**, so every QUERY list
endpoint is declared as a query in `orval.config.ts` — a new one needs the same entry. The client
never throws; `lib/api/apiFetch.ts` is the mutator that throws `ApiError`. Narrow a response on
`status` before use. **A list's key is a prefix of everything nested under it**: invalidate a QUERY
list with `listOnlyFilter(key)`, an exact key with `exactKeyFilter(key)`, a GET list with its key as
it is — and pass the filter as the whole argument. **Never write a length bound as a literal**;
`TEXT_LIMIT.<operation>.<field>.maxLength` from `src/api/textLimit.ts` is the calling operation's own.

## Forms

`useForm` from `@tanstack/vue-form` with field-level validators from `lib/validation/fieldSchemas.ts`
— each factory takes the operation's own `TEXT_LIMIT` and the wording for an empty field. One field
is one `FormTextField`, which owns `aria-describedby`. `maxlength` stays on short inputs; **prose
fields take none** and are checked on submit. Prefer `failureMessage(error)` over a hand-written
fallback; a 400 means schema drift, not a field problem.

## Where things live

`components/` by **domain** (`group/`, `thread/`, `forum/`, …), plus `layout/`, `common/` and
`context/` for the right rail; a dialog goes with its subject. `composables/` holds every `use*`;
`lib/` is grouped by kind, `format/` by what the value is. `lib/utils.ts` stays put because
`components.json` pins it. **`components/ui/` is generated territory**: never hand-write a component
there, run `shadcn-vue add` and reapply the house patches (`.claude/rules/frontend/shadcn.md`).
Anything we build on reka goes in `components/`, named for what it does, with `cn()`, a `data-slot`
and a `class?: HTMLAttributes['class']` prop.

## Errors and statuses

**An error a composable produces must have a renderer** — a component used in several layouts
renders its own, a form uses `Alert variant="destructive"` with `role="alert"`. Three statuses belong
to `queryClient` because the whole interface reacts to them: an unreachable backend, a 429, and a lost
session (a 401 without `code: "invalid_credentials"`). Everything else stays local.

## The frame

`App.vue` mounts `AppLayout` once; no page renders its own. A group's pages share `GroupLayout`,
read through `useGroupContext()`, which is reused when only `:groupId` changes — so nothing in it may
read the parameter at mount.

## knip and the lint record

knip runs in `validate:check` and fails on stale config (`--treat-config-hints-as-errors`). Only the
generated `ui/**/index.ts` barrels are ignored, so an unused `ui/` component is still reported.
`knip --production` is a manual audit for exports that exist only for tests. `.oxlintrc.json` lists
every rule that was tried and rejected, with what it cost — read it before proposing one.

## Verifying in the browser pane

It is not a fair witness for anything that moves: `requestAnimationFrame` and scroll events never
fire while it is hidden, CSS transitions freeze mid-flight, and floating content (a reka `Select`)
will not close until the pane is fronted. Verify structure and position — is it in the DOM, is the
target 44px via `elementFromPoint` — and treat "the animation did not play" as unproven. Use the
running app rather than mounting a view in a test to check what a member sees.
