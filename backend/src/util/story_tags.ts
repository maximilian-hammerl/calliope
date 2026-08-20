/**
 * Trims, drops the empties and removes repeats, comparing case-insensitively so "Fantasy" and
 * "fantasy" cannot both be stored. The first spelling wins, because that is the one the member
 * chose to type. A util rather than each service's own: writing_group and story_idea share the
 * story metadata column for column, so they must share its normalisation too.
 */
export function normaliseTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const normalised: string[] = [];

  for (const tag of tags) {
    const trimmed = tag.trim();
    const key = trimmed.toLocaleLowerCase("de");

    if (trimmed.length > 0 && !seen.has(key)) {
      seen.add(key);
      normalised.push(trimmed);
    }
  }

  return normalised;
}

/** A blank or whitespace-only optional field is stored as its absence. */
export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? null : trimmed;
}
