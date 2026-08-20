import { BookOpen, Users } from '@lucide/vue'
import type { RouteRecordName } from 'vue-router'

/**
 * The primary destinations, shared by the top bar and the bottom bar so the two cannot
 * disagree about which one a page belongs to — they did, over `/groups/discover`.
 *
 * `belongsTo` lists the route names that live under a destination. Matching by name rather
 * than by path prefix, because a route's name is what the guard and the views already use.
 */
export const DESTINATIONS = [
  {
    name: 'groups',
    label: 'Gruppen',
    icon: BookOpen,
    belongsTo: ['groups', 'group', 'thread', 'discover'],
  },
  {
    name: 'members',
    label: 'Mitglieder',
    icon: Users,
    belongsTo: ['members', 'member'],
  },
] as const

export function isCurrent(
  destination: (typeof DESTINATIONS)[number],
  routeName: RouteRecordName | null | undefined,
): boolean {
  return destination.belongsTo.some((name) => name === routeName)
}
