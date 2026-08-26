import { BookOpen, Lightbulb, Users } from '@lucide/vue'
import type { RouteRecordName } from 'vue-router'

/**
 * The primary destinations, shared by the top bar and the bottom bar so the two cannot
 * disagree about which one a page belongs to — they did once, over `/groups/discover`.
 *
 * **Every destination navigates**, which `name` being required is what enforces. There used to be
 * an optional `children` that opened a menu instead, and members reported it as a click they
 * should not have to make: every resource here has one view people open far more often than the
 * rest, so the bar goes straight there and the alternatives are a strip on the page itself. The
 * menu shape is in the history if it is ever genuinely wanted back.
 */
export const DESTINATIONS: ReadonlyArray<{
  label: string
  icon: typeof BookOpen
  name: string
  belongsTo: readonly string[]
}> = [
  {
    label: 'Gruppen',
    icon: BookOpen,
    name: 'myGroups',
    // `discover` stays here so the bar still marks Gruppen while discovery is open, even though
    // the bar no longer navigates there.
    belongsTo: ['myGroups', 'group', 'thread', 'discoverGroups'],
  },
  {
    label: 'Storyideen',
    icon: Lightbulb,
    // The carousel, not a list: reading through unread ideas is what members come here to do.
    name: 'storyIdeasCarousel',
    belongsTo: ['discoverStoryIdeas', 'myStoryIdeas', 'storyIdea', 'storyIdeasCarousel'],
  },
  {
    label: 'Mitglieder',
    icon: Users,
    name: 'members',
    belongsTo: ['members', 'member'],
  },
]

export function isCurrent(
  destination: (typeof DESTINATIONS)[number],
  routeName: RouteRecordName | null | undefined,
): boolean {
  return destination.belongsTo.some((name) => name === routeName)
}
