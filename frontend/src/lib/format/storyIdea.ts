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

export const PARTY_SIZE_LABELS = {
  one_on_one: 'Zu zweit',
  group: 'In einer Gruppe',
} as const
