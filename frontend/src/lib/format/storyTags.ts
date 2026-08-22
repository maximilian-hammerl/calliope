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

/**
 * A tag list as one line, or nothing when there are none — so a caller can drop the whole row
 * rather than print an empty one. The story details and a story idea both read this way.
 */
export function tagLine(tags: readonly string[]): string | undefined {
  return tags.length === 0 ? undefined : tags.join(', ')
}
