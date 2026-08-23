import { describe, expect, it } from 'vitest'
import { ENVIRONMENTS, environmentNotice } from '@/lib/environment'

describe('environmentNotice', () => {
  it('says nothing on production, and something everywhere else', () => {
    expect(environmentNotice('production')).toBeUndefined()

    for (const environment of ENVIRONMENTS.filter((value) => value !== 'production')) {
      expect(environmentNotice(environment)?.sentence).toBeTruthy()
      expect(environmentNotice(environment)?.label).toBeTruthy()
    }
  })

  it('warns about password reuse only where strangers can reach the instance', () => {
    expect(environmentNotice('development')?.publiclyReachable).toBe(false)
    expect(environmentNotice('testing')?.publiclyReachable).toBe(true)
    expect(environmentNotice('staging')?.publiclyReachable).toBe(true)
  })

  it('says what is lost, not merely that this is not production', () => {
    // The rule the copy exists for: one sentence, and it is the one that changes behaviour.
    expect(environmentNotice('testing')?.sentence).toContain('gelöscht')
    // The same consequence gets the same words: a synonym invites a reader to look for a
    // difference that is not there.
    expect(environmentNotice('development')?.sentence).toContain('gelöscht')
  })

  it('does not warn about losing writing where nothing is lost', () => {
    // Staging keeps what people write, so a data-loss sentence there would be untrue — and an
    // untrue warning is how the true ones stop being read.
    expect(environmentNotice('staging')?.sentence).not.toContain('gelöscht')
  })

  it('has no exclamation marks, per the design system', () => {
    for (const environment of ENVIRONMENTS) {
      expect(environmentNotice(environment)?.sentence ?? '').not.toContain('!')
    }
  })
})
