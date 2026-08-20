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

export const PARTY_SIZE_LABELS = {
  one_on_one: 'Zu zweit',
  group: 'In einer Gruppe',
} as const
