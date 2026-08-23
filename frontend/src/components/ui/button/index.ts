import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export { default as Button } from './Button.vue'

/**
 * Which level an act gets is decided by its subject, never by the page it was built on. One
 * question settles it: is the subject the whole screen, or one row of it?
 *
 *   default      Solid — completes a form or a dialog; one per screen
 *   outline      Quiet — an action on the object the screen is about, or on a section
 *   ghost        Plain — an action on one row of a list
 *   destructive  destroys writing, including other people's, and repeating it cannot undo that
 *
 * A dismiss beside a Solid act takes Quiet. Icons follow the act — `Plus` adds, `Pencil` edits,
 * `Trash2` deletes for good — while „Entfernen" and a footer's confirm take none.
 *
 * Reasons, exceptions and the copy rules: `.claude/skills/design-system/readme.md`, "Buttons".
 *
 * Icons are 14px, not Lucide-in-shadcn's 16: "size them to the text they sit beside", and this
 * level's text is 14px. `xs` sets its own below.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-3.5 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        // Quiet, the second level: paper-3 fill, line-5 border, accent-deep at 500. Byte for
        // byte what „＋ Schritt" hand-rolls in the rail — the two must not drift apart again.
        outline: 'border border-line-5 bg-paper-3 font-medium text-oak-deep hover:bg-paper-4',
        // Plain: the text darkens and nothing else. shadcn's own ghost adds a background on
        // hover, and `--accent` here is `--surface-quiet` — the Quiet fill — so that turned a
        // Plain button into a Quiet one under the pointer, border aside. The text colour it
        // already used, `--accent-foreground`, is `--accent-deep`, which is what the fourteen
        // hand-rolled plain controls hover to.
        ghost: 'hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 min-h-11 px-4 py-2 md:min-h-0 has-[>svg]:px-3',
        xs: "h-6 gap-1 rounded-lg px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 min-h-11 rounded-lg gap-1.5 px-3 md:min-h-0 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-lg px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': "size-6 rounded-lg [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
