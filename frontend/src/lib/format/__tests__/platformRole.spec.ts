import { describe, expect, it } from 'vitest'
import { platformRoleLabel } from '../platformRole'

describe('platformRoleLabel', () => {
  it('names both levels as functions rather than as people', () => {
    expect(platformRoleLabel('moderator')).toBe('Moderation')
    expect(platformRoleLabel('administrator')).toBe('Administration')
  })

  /** Most members have no role, and the views `v-if` on the absence rather than on a value. */
  it('is undefined for an ordinary member', () => {
    expect(platformRoleLabel(null)).toBeUndefined()
    expect(platformRoleLabel(undefined)).toBeUndefined()
  })

  /** „Admin" is a group's administrator in GroupMembers.vue, and must not mean the platform's. */
  it('does not reuse the group role wording', () => {
    expect(platformRoleLabel('administrator')).not.toBe('Admin')
  })
})
