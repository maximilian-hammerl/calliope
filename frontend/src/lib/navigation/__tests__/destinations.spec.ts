import { describe, expect, it } from 'vitest'
import type { RouteRecordRaw } from 'vue-router'
import { DESTINATIONS, isCurrent } from '@/lib/navigation/destinations'
import { routes } from '@/router/routes'

/**
 * The bars are built from this list, so what it says is what a member can reach in one press.
 * Which view each destination opens is a product decision — members reported the old menu as a
 * click they should not have to make — and nothing else in the suite would notice it changing.
 */
function routeNames(records: readonly RouteRecordRaw[]): string[] {
  return records.flatMap((record) => [
    ...(typeof record.name === 'string' ? [record.name] : []),
    ...routeNames(record.children ?? []),
  ])
}

const NAMES = routeNames(routes)

describe('DESTINATIONS', () => {
  it('opens the view members actually want, in one press', () => {
    expect(DESTINATIONS.map((destination) => [destination.label, destination.name])).toEqual([
      ['Gruppen', 'myGroups'],
      // The carousel rather than either list: reading through unread ideas is the point of the page.
      ['Storyideen', 'storyIdeasCarousel'],
      ['Mitglieder', 'members'],
    ])
  })

  it('names routes that exist', () => {
    // A renamed route would otherwise leave a bar item that navigates nowhere, or one that never
    // marks itself — the second is silent, which is how `/groups/discover` drifted once before.
    const named = DESTINATIONS.flatMap((destination) => [
      ...(destination.name === undefined ? [] : [destination.name]),
      ...destination.belongsTo,
    ])

    expect(named.filter((name) => !NAMES.includes(name))).toEqual([])
  })

  it('marks a destination while any of its pages is open', () => {
    const groups = DESTINATIONS[0]
    expect(groups && isCurrent(groups, 'discoverGroups')).toBe(true)
    expect(groups && isCurrent(groups, 'thread')).toBe(true)
    expect(groups && isCurrent(groups, 'members')).toBe(false)
  })
})
