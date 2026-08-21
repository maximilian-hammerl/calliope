import { BookOpen, Lightbulb, Users } from '@lucide/vue'
import type { RouteRecordName } from 'vue-router'

type Child = { name: string; label: string }

/**
 * The primary destinations, shared by the top bar and the bottom bar so the two cannot
 * disagree about which one a page belongs to — they did once, over `/groups/discover`.
 *
 * A destination with `children` opens a menu naming its pages — each by the page's own title,
 * because a destination is named the same everywhere. One without navigates directly.
 */
export const DESTINATIONS: ReadonlyArray<{
  label: string
  icon: typeof BookOpen
  belongsTo: readonly string[]
  name?: string
  children?: readonly Child[]
}> = [
  {
    label: 'Gruppen',
    icon: BookOpen,
    belongsTo: ['groups', 'group', 'thread', 'discover'],
    children: [
      { name: 'groups', label: 'Meine Gruppen' },
      { name: 'discover', label: 'Gruppen entdecken' },
    ],
  },
  {
    label: 'Storyideen',
    icon: Lightbulb,
    belongsTo: ['storyIdeas', 'storyIdeasMine', 'storyIdea', 'storyIdeasCarousel'],
    children: [
      { name: 'storyIdeasMine', label: 'Meine Storyideen' },
      { name: 'storyIdeas', label: 'Storyideen entdecken' },
      { name: 'storyIdeasCarousel', label: 'Story-Karussell' },
    ],
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
