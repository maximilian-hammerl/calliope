import { describe, expect, it } from 'vitest'
import { listKeyPrefix } from '../queryKeys'

/** The shape Orval generates: path segments, then the request body in the final slot. */
const key = (body: unknown) => ['QUERY', 'api', 'groups', 'g-1', 'memberships', body] as const

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
    const otherGroup = ['QUERY', 'api', 'groups', 'g-2', 'memberships', {}] as const

    expect(partialDeepEqual(otherGroup, listKeyPrefix(key(undefined)))).toBe(false)
  })
})
