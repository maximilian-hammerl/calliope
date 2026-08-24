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
 * Whether the member has read it, which is the only state this table carries now. Keeping
 * something to come back to used to be the second value of the same column and is a favourite
 * now — one mechanism across groups, threads, ideas, chats and posts.
 *
 * The button names the state it will put the idea in rather than the act: "Als gelesen markieren"
 * and its undo were wider than most ideas' titles on a phone, so the long phrasing stays as the
 * `title`, which is also where the fact that it is a toggle lives.
 */
export function readToggle(isRead: boolean): { label: string; title: string; next: boolean } {
  return isRead
    ? { label: 'Nicht gelesen', title: 'Als ungelesen markieren', next: false }
    : { label: 'Gelesen', title: 'Als gelesen markieren', next: true }
}

export const PARTY_SIZE_LABELS = {
  one_on_one: 'Zu zweit',
  group: 'In einer Gruppe',
} as const
