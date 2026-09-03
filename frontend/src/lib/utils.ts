import type { ClassValue } from 'clsx'
import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * The type scale, which tailwind-merge cannot infer. It reads `text-*` and guesses: a t-shirt
 * size is a size, anything else is a colour — so it filed `text-note` under colour, and
 * `cn('text-note text-ink-5', …)` merged the two into `text-ink-5` and silently dropped the
 * size. Named sizes have to be declared for the guess to come out right.
 *
 * Kept in step with theme.css by a test, since a new size that is not listed here fails the
 * same silent way.
 */
export const FONT_SIZES = ['h1', 'h2', 'h3', 'body', 'note', 'nav', 'row', 'control', 'rail']

const twMerge = extendTailwindMerge({ extend: { theme: { text: FONT_SIZES } } })

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
