/**
 * Genres, subgenres, tropes and content warnings are arrays in the API and a comma-separated
 * line in the form. A plain text input rather than a tag widget: it is keyboard-first, it
 * pastes, and it needs no explaining — and the API tidies what arrives anyway.
 */
export function toTags(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

export function fromTags(tags: readonly string[]): string {
  return tags.join(', ')
}
