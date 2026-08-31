import type { Component } from 'vue'
import { Star, StarOff } from '@lucide/vue'

type FavouriteState = 'favourite' | 'notFavourite'

/**
 * The word and the glyph for each state, in one place across all five kinds the favourite covers.
 * `FavouriteMark` reads the first of these and the toggle below reads both, so a row and a button
 * cannot say the same state two ways — the star in a list meant nothing to testers precisely
 * because the button beside it carried no star.
 *
 * **„Favorit", not „Gemerkt".** The design system forbade this word until the mark stopped being a
 * story idea's alone; the reversal and its argument are written down there.
 */
export const FAVOURITE_LABELS: Record<FavouriteState, string> = {
  favourite: 'Favorit',
  notFavourite: 'Kein Favorit',
}

export const FAVOURITE_ICONS: Record<FavouriteState, Component> = {
  favourite: Star,
  notFavourite: StarOff,
}

export function favouriteToggle(isFavourite: boolean): {
  label: string
  title: string
  icon: Component
  next: boolean
} {
  // The state it will put the thing in, never the act — the same rule the read toggle follows,
  // and the reason the long phrasing lives in `title` instead.
  const next: FavouriteState = isFavourite ? 'notFavourite' : 'favourite'

  return {
    label: FAVOURITE_LABELS[next],
    title: isFavourite ? 'Aus den Favoriten entfernen' : 'Als Favorit markieren',
    icon: FAVOURITE_ICONS[next],
    next: !isFavourite,
  }
}

/** What every list calls the filter, so no two of them can word it differently. */
export const FAVOURITE_FILTER_LABELS = {
  any: 'Alle',
  only: 'Favoriten',
} as const
