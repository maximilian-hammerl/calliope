import type { Component } from 'vue'
import { Eye, EyeOff } from '@lucide/vue'
import type { ListForumFolders200ResultsItemEffectiveMemberPermission as ForumPermission } from '@/api/models'

export type { ForumPermission }

/**
 * What *members* may do with a row, shown to operators only: a member's own view is already the
 * answer, so marking it would be the bare badge §2.5 objected to.
 *
 * `write` has no mark — the ordinary case, and marking it would bury the two that matter.
 */
export const FORUM_PERMISSION_LABELS: Record<ForumPermission, string | undefined> = {
  hidden: 'Für Mitglieder verborgen',
  read: 'Mitglieder können nur lesen',
  write: undefined,
}

export const FORUM_PERMISSION_ICONS: Record<ForumPermission, Component | undefined> = {
  hidden: EyeOff,
  read: Eye,
  write: undefined,
}

/** What carries a permission, for the sentence each choice needs. */
export type ForumPermissionKind = 'folder' | 'thread' | 'page'

const SUBJECT: Record<ForumPermissionKind, string> = {
  folder: 'den Ordner und alles darin',
  thread: 'das Thema',
  page: 'die Seite',
}

/**
 * The three settings an operator picks between, in the order they read: what members may do, most
 * open first. The label says what it *grants* rather than naming the value, because „read" tells
 * a member nothing about whether they can answer.
 *
 * Takes the kind, because only the hidden case has to name what disappears.
 */
export function forumPermissionChoices(
  kind: ForumPermissionKind,
): ReadonlyArray<{ value: ForumPermission; label: string; note: string }> {
  return [
    {
      value: 'write',
      label: 'Mitschreiben',
      note: 'Mitglieder lesen und schreiben hier.',
    },
    {
      value: 'read',
      label: 'Nur lesen',
      note: 'Mitglieder lesen mit, schreiben aber nicht mehr.',
    },
    {
      value: 'hidden',
      label: 'Verborgen',
      note: `Nur die Moderation sieht ${SUBJECT[kind]}.`,
    },
  ]
}
