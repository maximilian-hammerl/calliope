import type { Component } from 'vue'
import { Book, BookCheck, Circle, CircleCheckBig } from '@lucide/vue'
import type { GetStoryIdea200 } from '@/api/models'

/** German labels for the idea's enums, one place so the row and detail agree. */
export const IDEA_STATUS_LABELS: Record<GetStoryIdea200['status'], string> = {
  open: 'Offen',
  closed: 'Geschlossen',
}

/**
 * Beside the label, and beside it in the row's mark — the two would otherwise be free to say the
 * state with different glyphs. `CircleCheckBig` rather than a lock: a closed idea keeps its page
 * and every word of it, so a lock would say you cannot get in. The ring and the check are the
 * same pair the step list draws as `Square` and `SquareCheck`.
 */
export const IDEA_STATUS_ICONS: Record<GetStoryIdea200['status'], Component> = {
  open: Circle,
  closed: CircleCheckBig,
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
type ReadState = 'read' | 'unread'

/**
 * The word and the glyph for each state. `ReadMark` reads the first of these and the toggle below
 * reads both, so the mark in a row and the button on the page cannot drift — the same arrangement
 * `IDEA_STATUS_*` and `FAVOURITE_*` use.
 */
export const READ_LABELS: Record<ReadState, string> = {
  read: 'Gelesen',
  unread: 'Nicht gelesen',
}

/** `BookCheck` closed, not `BookOpenCheck`: an open book reads as *being* read, and its page
 * curves plus the check are dense at 13px. */
export const READ_ICONS: Record<ReadState, Component> = {
  read: BookCheck,
  unread: Book,
}

export function readToggle(isRead: boolean): {
  label: string
  title: string
  icon: Component
  next: boolean
} {
  // The destination the label names, never the act — the rule the favourite toggle follows too.
  const next: ReadState = isRead ? 'unread' : 'read'

  return {
    label: READ_LABELS[next],
    title: isRead ? 'Als ungelesen markieren' : 'Als gelesen markieren',
    icon: READ_ICONS[next],
    next: !isRead,
  }
}

export const PARTY_SIZE_LABELS = {
  one_on_one: 'Zu zweit',
  group: 'In einer Gruppe',
} as const
