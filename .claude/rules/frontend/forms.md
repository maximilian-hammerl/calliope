---
paths:
  - "frontend/src/lib/validation/**"
  - "frontend/src/components/common/FormTextField.vue"
  - "frontend/src/components/**/*Dialog.vue"
  - "frontend/src/views/RegisterView.vue"
  - "frontend/src/views/LoginView.vue"
  - "frontend/src/components/settings/**"
---

# Forms are Zod schemas over TanStack Form

`useForm` from `@tanstack/vue-form` with **field-level validators**. Validation used to read the
inputs' own `ValidityState`; that was eight copies of one loop and „Das Passwort darf höchstens 256
Zeichen lang sein." written out seven times.

- **A field's rules live once, in `lib/validation/fieldSchemas.ts`.** Each factory takes the
  **calling operation's own** bound from `TEXT_LIMIT` — never another operation's — and the wording
  for an *empty* field, which names what is being asked for („Wähle ein Passwort" registering,
  „Gib dein aktuelles Passwort ein" confirming). Length and format wording is declared once.
- **Rules are written in the order a member should read them.** Zod keeps failing checks in
  declaration order and `firstMessage()` shows the first, so `.min(1, missing)` before
  `.min(3, tooShort)` makes an empty field say "enter one" rather than "needs three".
- **The email rule is the backend's rule**, `z.regexes.html5Email`. `type="email"` stays for the
  keyboard it summons, not for validation.
- **`maxlength` stays on the input** for titles and names, because it stops the typing. **Prose
  fields take no `maxlength`** — a body is checked on submit and the draft left untouched; typing
  that stops dead mid-word, or a live counter, is what the research rejected as pressure.
- **One field is one `FormTextField`**: `aria-invalid`, `data-invalid`, the change handler, the
  error and `aria-describedby` — without which a field says *that* it is wrong and never *why*. It
  generates its own id; `id` is a prop only for the rare case of something outside naming the input.
  `multiline` for prose, `label-hidden` for the chat row — still one field.
- **A failed submit moves focus to the first marked field**, `onSubmitInvalid` → `focusFirstInvalid()`.
- **A 400 is schema drift, not a field problem.** The client enforces every rule the API does, so a
  refusal on shape means the deployed two disagree; `failureMessage()` says to reload. A **401 or
  409** stays on the field it is about, via `setFieldMeta`.

Prefer `failureMessage(error)` over a hand-written fallback — it already answers 429 with the wait
the server named. Interpolate limits through `formatCount()` so they read as German.

**One dialog per subject, not one per verb.** `GroupDialog` and `StoryIdeaDialog` each found *and*
edit; an absent subject prop means creating. A dialog that saves **emits** rather than navigates —
where to go belongs to the caller. **A closed dialog keeps its content** unless the call site also
gates it with `v-if`, so two `ReportDialog`s on one page both had their fields in the DOM and every
`<label for>` resolved to the hidden one.
