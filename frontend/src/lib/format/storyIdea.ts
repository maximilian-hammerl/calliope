import type { GetStoryIdea200 } from '@/api/models'

/** German labels for the idea's enums, one place so the row and detail agree. */
export const IDEA_STATUS_LABELS: Record<GetStoryIdea200['status'], string> = {
  open: 'Offen',
  closed: 'Geschlossen',
}

export const LANGUAGE_LABELS: Record<GetStoryIdea200['language'], string> = {
  german: 'Deutsch',
  english: 'Englisch',
}

/**
 * The member's own state. "Merken" is the design system's word for saving something for
 * later — «"Merken", not "Zu Lesezeichen hinzufügen"» — so it is reused rather than
 * inventing "Favorit", which would also promise a permanence the author can end.
 */
export const READER_STATE_LABELS = {
  read: 'Gelesen',
  marked: 'Gemerkt',
} as const

type ReaderState = GetStoryIdea200['readerState']

/**
 * One button per state, naming the state it will put the idea in. "Als gelesen markieren" and
 * its undo were wider than most ideas' titles on a phone; the full phrasing stays as the
 * button's `title`, which is also where the fact that it is a toggle now lives.
 */
export function readerStateToggles(
  current: ReaderState,
): ReadonlyArray<{ label: string; title: string; next: ReaderState }> {
  return [
    current === 'read'
      ? { label: 'Nicht gelesen', title: 'Als ungelesen markieren', next: null }
      : { label: 'Gelesen', title: 'Als gelesen markieren', next: 'read' },
    current === 'marked'
      ? { label: 'Nicht gemerkt', title: 'Nicht mehr merken', next: null }
      : { label: 'Gemerkt', title: 'Merken', next: 'marked' },
  ]
}

export const PARTY_SIZE_LABELS = {
  one_on_one: 'Zu zweit',
  group: 'In einer Gruppe',
} as const
