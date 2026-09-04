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
