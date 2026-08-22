/**
 * Prose a member reads, built from what they typed or from a count. Not a home for anything
 * that produces text — that is every file here; a time, a number, a name and a device each
 * have their own.
 */
import { formatCount } from '@/lib/format/formatNumber'

/**
 * Long-form prose as the paragraphs a member typed. A plain textarea carries them as blank
 * lines, and a single `<p>` would render an eight-thousand-character synopsis as one wall.
 */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}

/** "14 Beiträge", "1 Beitrag" — the design system requires a noun beside every number. */
export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`
}

export function capitalize(text: string): string {
  if (text.length === 0) {
    return ''
  }
  return text.charAt(0).toUpperCase() + text.slice(1)
}
