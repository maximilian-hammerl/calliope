import { describe, expect, it } from 'vitest'
import { exactKeyFilter, listKeyPrefix, listOnlyFilter } from '../queryKeys'

/** The shape Orval generates for a QUERY list: path segments, then the body in the final slot. */
const key = (body: unknown) =>
  ['QUERY', 'api', 'groups', 'g-1', 'threads', 't-1', 'posts', body] as const

/** TanStack's own partial matcher, so this asserts against the real rule. */
function partialDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return Object.keys(b).every((k) =>
      partialDeepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  }
  return false
}

describe('listKeyPrefix', () => {
  it('matches a cached page whose body the caller does not know', () => {
    const cached = key({ limit: 100 })

    // The trap this helper exists for: the argument-less key does not match.
    expect(partialDeepEqual(cached, key(undefined))).toBe(false)
    expect(partialDeepEqual(cached, listKeyPrefix(key(undefined)))).toBe(true)
  })

  it('matches every page of the same list', () => {
    const prefix = listKeyPrefix(key(undefined))

    for (const body of [{ limit: 100 }, { limit: 20, offset: 40 }, { search: 'ann' }]) {
      expect(partialDeepEqual(key(body), prefix)).toBe(true)
    }
  })

  it('does not match a different list', () => {
    const otherThread = ['QUERY', 'api', 'groups', 'g-1', 'threads', 't-2', 'posts', {}] as const

    expect(partialDeepEqual(otherThread, listKeyPrefix(key(undefined)))).toBe(false)
  })

  it('is the wrong tool for a key with no body slot', () => {
    // A GET list — threads, memberships — is its whole key. Dropping the last slot leaves
    // `['api','groups','g-1']`, which matches every other nested GET of that group.
    const memberships = ['api', 'groups', 'g-1', 'memberships'] as const
    const steps = ['api', 'groups', 'g-1', 'steps'] as const

    expect(partialDeepEqual(steps, listKeyPrefix(memberships))).toBe(true)
    expect(partialDeepEqual(steps, memberships)).toBe(false)
  })
})

describe('listOnlyFilter', () => {
  const groups = ['QUERY', 'api', 'groups', undefined] as const

  it('matches every page of the list', () => {
    const filter = listOnlyFilter(groups)

    for (const body of [{ limit: 10 }, { limit: 10, offset: 10 }]) {
      const cached = ['QUERY', 'api', 'groups', body] as const
      expect(partialDeepEqual(cached, filter.queryKey)).toBe(true)
      expect(filter.predicate({ queryKey: cached })).toBe(true)
    }
  })

  it('does not match what is nested under the list', () => {
    // The reason it exists: the groups key is a prefix of every thread's posts, so a plain
    // prefix invalidation refetched whichever thread was open — once per loaded page.
    const posts = ['QUERY', 'api', 'groups', 'g-1', 'threads', 't-1', 'posts', {}] as const

    expect(partialDeepEqual(posts, listOnlyFilter(groups).queryKey)).toBe(true)
    expect(listOnlyFilter(groups).predicate({ queryKey: posts })).toBe(false)
  })
})

describe('exactKeyFilter', () => {
  /** A GET list's whole key is its identity: there is no body slot to drop. */
  const pages = ['api', 'forum', 'pages'] as const

  it('matches the list itself', () => {
    const filter = exactKeyFilter(pages)

    expect(partialDeepEqual(pages, filter.queryKey)).toBe(true)
    expect(filter.predicate({ queryKey: pages })).toBe(true)
  })

  it('does not match an item of that list', () => {
    // The reason it exists: creating a page invalidated every page detail the reader had open,
    // because the list's key is a prefix of each of them.
    const onePage = ['api', 'forum', 'pages', 'p-1'] as const

    expect(partialDeepEqual(onePage, exactKeyFilter(pages).queryKey)).toBe(true)
    expect(exactKeyFilter(pages).predicate({ queryKey: onePage })).toBe(false)
  })

  it('does not match a different list of the same length', () => {
    const threads = ['api', 'forum', 'threads'] as const

    expect(partialDeepEqual(threads, exactKeyFilter(pages).queryKey)).toBe(false)
  })
})
