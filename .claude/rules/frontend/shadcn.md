---
paths:
  - "frontend/src/components/ui/**"
  - "frontend/components.json"
  - "frontend/src/assets/main.css"
---

# shadcn-vue: the CLI will undo things

**Use the CLI anyway.** A hand-written copy is a copy of what you *remember* the component being —
a replicated popover came out missing `inheritAttrs: false`, the `$attrs` spread, the root's
`v-slot` forwarding and its available-width `max-w`. Run `add`, restore what the checklist names,
reapply the patches. Decline every overwrite prompt: `yes n | npx shadcn-vue@latest add …`.

Reaching past a component to reka is right when what you build is not the component (`SearchField`,
`ContextSheet` say so in a docblock) and wrong when the thing you want *is* the component.

`add` rewrites `src/assets/main.css` on **every** run (replaces the font import, appends a duplicate
`@layer base`), puts `^` back on every dependency it touches, and offers to overwrite patched files.

## After any `add`

```bash
git diff src/assets/main.css   # expect no change; restore the font import if there is one
grep '"\^' package.json | grep -v '"node"'                                            # expect no output
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
grep -c injectCollapsibleRootContext src/components/ui/accordion/AccordionTrigger.vue   # expect 2
grep -c border-line-5 src/components/ui/radio-group/RadioGroupItem.vue src/components/ui/checkbox/Checkbox.vue  # expect 1 each
grep -c 'data-\[state=checked\]:bg-oak' src/components/ui/checkbox/Checkbox.vue         # expect 1
grep -c fill-oak src/components/ui/radio-group/RadioGroupItem.vue                       # expect 1
grep -c object-cover src/components/ui/avatar/AvatarImage.vue                           # expect 1
grep -c 'border-b-2' src/components/ui/pagination/PaginationItem.vue                   # expect 1
grep -c min-h-11 src/components/ui/pagination/PaginationItem.vue src/components/ui/pagination/PaginationPrevious.vue src/components/ui/pagination/PaginationNext.vue  # expect 1 each
grep -rc 'hidden sm:block' src/components/ui/pagination/                               # expect 0
ls src/components/ui/pagination/PaginationFirst.vue src/components/ui/pagination/PaginationLast.vue  # expect neither to exist
grep -c 'sr-only">Schließen' src/components/ui/dialog/DialogContent.vue src/components/ui/dialog/DialogScrollContent.vue  # expect 1 each
grep -c 'id: contentId' src/components/ui/dialog/DialogContent.vue src/components/ui/dialog/DialogScrollContent.vue  # expect 1 each
grep -rL 'aria-hidden\|aria-label' $(grep -rl '@lucide/vue' src/components/ui/ --include='*.vue')  # expect no output
```

## What the patches are, and why

- **Button `outline` is the design system's Quiet level** (`bg-paper-3`, `border-line-5`,
  `text-oak-deep`, 500); `secondary` is deleted rather than left as a borderless near-twin.
- **Every control is `rounded-lg`** (6px), `shadow-xs` stripped — nothing at rest casts a shadow.
  `popover/` likewise, dropping shadcn's `shadow-md`. Dialog keeps its own shadow.
- **Input and SelectTrigger carry `min-h-11 md:min-h-0`**, so the 44px target is not written at
  each call site (it was, at 39). `DropdownMenuItem`, `DialogContent`, `navigation-menu` and the
  pagination pieces carry the same rule. `Spinner` is `size-3.5` to match the icons.
- **`AvatarFallback`** takes `bg-avatar text-avatar-foreground` (shadcn's `bg-muted` is the rail
  colour); **`AvatarImage`** takes `object-cover`, or a portrait is stretched into the square.
- **Radio and checkbox** share the `border-line-5` hairline and fill with oak; the 44px target is
  the wrapping label's, not the 16px box's.
- **Pagination**: current page is an underline, „Zurück"/„Weiter" replace the English *and* the
  `hidden sm:block` (measured: the 44px numbers wrap the strip, not the words).
  `PaginationFirst`/`PaginationLast` are deleted; `showEdges` already draws the first and last.
- **Every icon shadcn hardcodes is `aria-hidden`** — each sits beside an `aria-expanded`, an
  `ItemIndicator` that only renders when checked, or the `sr-only` label. Both dialogs' close buttons
  say „Schließen", not `Close`: anything visible only to a screen reader is still copy.
- **`AccordionTrigger` claims its content's id** (`||=`), because reka fills `contentId` as the
  content renders and the trigger renders first — `aria-controls=""` on every accordion otherwise.
  `DialogContent`'s `id: contentId` is the same fix. It shows `ChevronRight` shut and `ChevronDown`
  open rather than rotating one glyph.
- **A string template ref does not compile here**: `noUnusedLocals` reads `ref="carouselRef"` as
  unused, and binding it fails because a template unwraps a ref. Use a function ref.
- **There are two dialog contents** — `DialogContent` centres, `DialogScrollContent` scrolls. Anything
  done to one belongs in the other; neither sets a desktop width, each dialog picks a named one.
