/**
 * The one place the favourite's wording lives, across all five kinds it covers — the same role
 * `readToggle` plays for a story idea's read state.
 *
 * **„Favorit", not „Gemerkt".** The design system forbade this word until the mark stopped being a
 * story idea's alone; the reversal and its argument are written down there.
 */
export function favouriteToggle(isFavourite: boolean): {
  label: string
  title: string
  next: boolean
} {
  // The state it will put the thing in, never the act — the same rule the read toggle follows,
  // and the reason the long phrasing lives in `title` instead.
  return isFavourite
    ? {
        label: 'Kein Favorit',
        title: 'Aus den Favoriten entfernen',
        next: false,
      }
    : { label: 'Favorit', title: 'Als Favorit markieren', next: true }
}

/** What every list calls the filter, so no two of them can word it differently. */
export const FAVOURITE_FILTER_LABELS = {
  any: 'Alle',
  only: 'Favoriten',
} as const
