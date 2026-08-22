import { describe, expect, it } from 'vitest'
import { formatActivityTime } from '../formatTime'

const now = new Date('2026-08-17T12:00:00Z')
const ago = (milliseconds: number) => new Date(now.getTime() - milliseconds).toISOString()

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatActivityTime', () => {
  it('reads as relative under a day', () => {
    expect(formatActivityTime(ago(12 * MINUTE), now)).toBe('vor 12 Minuten')
    expect(formatActivityTime(ago(MINUTE), now)).toBe('vor 1 Minute')
    expect(formatActivityTime(ago(3 * HOUR), now)).toBe('vor 3 Stunden')
    expect(formatActivityTime(ago(HOUR), now)).toBe('vor 1 Stunde')
  })

  it('names the weekday between a day and a week', () => {
    expect(formatActivityTime(ago(2 * DAY), now)).toMatch(
      /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag), \d{2}:\d{2}$/u,
    )
  })

  it('becomes a date beyond a week, with the year only when it differs', () => {
    expect(formatActivityTime(ago(30 * DAY), now)).toBe('18. Juli')
    expect(formatActivityTime(ago(400 * DAY), now)).toBe('13. Juli 2025')
  })

  it('never reports a future time when the clock is slightly behind the server', () => {
    expect(formatActivityTime(new Date(now.getTime() + 3000).toISOString(), now)).toBe(
      'gerade eben',
    )
  })
})
