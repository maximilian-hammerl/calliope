import { describe, expect, it } from 'vitest'
import { rateLimitMessage, rateLimitWait } from '../rateLimit'

describe('rateLimitWait', () => {
  it('says nothing when the header was absent', () => {
    expect(rateLimitWait(undefined)).toBeUndefined()
    expect(rateLimitWait(0)).toBeUndefined()
  })

  it('reads seconds under a minute as seconds, and counts one properly', () => {
    expect(rateLimitWait(1)).toBe('in einer Sekunde')
    expect(rateLimitWait(59)).toBe('in 59 Sekunden')
  })

  /** Rounded up: told "in 1 Minute" at 61 seconds a member tries again too early. */
  it('never understates the wait', () => {
    expect(rateLimitWait(60)).toBe('in einer Minute')
    expect(rateLimitWait(61)).toBe('in 2 Minuten')
    expect(rateLimitWait(900)).toBe('in 15 Minuten')
  })
})

describe('rateLimitMessage', () => {
  it('names the wait when there is one', () => {
    expect(rateLimitMessage(878)).toBe('Zu viele Anfragen. Versuche es in 15 Minuten noch einmal.')
  })

  it('still says what happened without one', () => {
    expect(rateLimitMessage()).toBe(
      'Zu viele Anfragen. Versuche es in einigen Minuten noch einmal.',
    )
  })
})
