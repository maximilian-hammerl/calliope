import type { Component } from 'vue'
import { EyeOff, PencilOff } from '@lucide/vue'
import { assertUnreachable } from '@/lib/assertUnreachable'
import type { ListForumFolders200ResultsItemEffectiveMemberPermission as ForumPermission } from '@/api/models'

export type { ForumPermission }

/**
 * What a row's permission looks like as a mark. `write` renders nothing: it is the ordinary case,
 * and marking it would bury the one that matters and put a second glyph on nearly every row.
 *
 * **The glyph is a negation, which is what lets it stand alone.** A slashed pencil says "no
 * writing here" without its opposite beside it, where `Eye` named a thing and needed a partner —
 * one a member never saw, since a hidden row is not in their lists at all. It is also the right
 * subject: what a permission restricts is writing, not seeing.
 *
 * The word differs by who is reading, because „Mitglieder können nur lesen" reads to a member as
 * being about somebody else. `StateMark` carries it as `aria-label` and `title`, which is how it
 * survives without costing the row the 60px a chip would.
 */
export function forumPermissionMark(
  permission: ForumPermission,
  isOperator: boolean,
): { icon: Component; label: string } | undefined {
  switch (permission) {
    case 'write':
      return undefined
    case 'read':
      return {
        icon: PencilOff,
        label: isOperator ? 'Mitglieder können nur lesen' : 'Du kannst hier nur lesen',
      }
    case 'hidden':
      // Only an operator ever meets this: a hidden row is filtered out of a member's lists, so
      // the guard is what keeps a mark from appearing if that ever stops being true.
      return isOperator ? { icon: EyeOff, label: 'Für Mitglieder verborgen' } : undefined
    default:
      return assertUnreachable(permission)
  }
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
