import { describe, expect, it } from 'vitest'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from '../routes'

/**
 * The two resources with more than one view are laid out the same way — `mine`, `discover`, and a
 * bare path that follows whatever the bar opens. Written out here rather than derived, so changing
 * a URL has to be deliberate: these are addresses people paste to each other.
 */
const RESOLVES = [
  ['/groups/mine', 'myGroups'],
  ['/groups/discover', 'discoverGroups'],
  ['/story-ideas/mine', 'myStoryIdeas'],
  ['/story-ideas/discover', 'discoverStoryIdeas'],
  ['/story-ideas/carousel', 'storyIdeasCarousel'],
] as const

describe('resource paths', () => {
  const router = createRouter({ history: createWebHistory(), routes })

  for (const [path, name] of RESOLVES) {
    it(`${path} is ${name}`, () => {
      expect(router.resolve(path).name).toBe(name)
    })
  }

  // `mine` and `discover` sit beside `/groups/:groupId`, so the danger is one being read as an id.
  // vue-router ranks a static segment above a parameter, and this is what holds it to that.
  it('reads a literal segment as itself, not as an id', () => {
    expect(router.resolve('/groups/mine').params).toEqual({})
    expect(router.resolve('/story-ideas/mine').params).toEqual({})
    expect(router.resolve('/groups/g-1').name).toBe('group')
    expect(router.resolve('/story-ideas/i-1').name).toBe('storyIdea')
  })

  // `resolve` does not follow a redirect — it matches the record and stops — so this reads the
  // record's own target rather than the resolved name.
  function redirectTargetOf(path: string): unknown {
    return router.getRoutes().find((route) => route.path === path)?.redirect
  }

  it('sends the bare resource path where the bar goes', () => {
    // There is no catch-all, so without these the paths render nothing at all. `/story-ideas`
    // used to *be* the discovery board; it now follows the bar to the carousel.
    expect(redirectTargetOf('/groups')).toEqual({ name: 'myGroups' })
    expect(redirectTargetOf('/story-ideas')).toEqual({ name: 'storyIdeasCarousel' })
  })
})
