/**
 * Relative under a day, absolute above it: "vor 12 Minuten" → "Dienstag, 09:14" → "12. Februar".
 * The design system fixes this ladder, so it lives in one place rather than at each call site.
 */
const WEEKDAY_AND_TIME = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

const DAY_AND_MONTH = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' })

const DAY_MONTH_AND_YEAR = new Intl.DateTimeFormat('de-DE', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

export function formatActivityTime(isoTimestamp: string, now: Date = new Date()): string {
  const at = new Date(isoTimestamp)
  const elapsed = now.getTime() - at.getTime()

  // A clock that is slightly behind the server must not produce "in 3 Sekunden".
  if (elapsed < MINUTE) {
    return 'gerade eben'
  }
  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE)
    return `vor ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`
  }
  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR)
    return `vor ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`
  }
  if (elapsed < WEEK) {
    return WEEKDAY_AND_TIME.format(at)
  }
  // Within the same year the year itself carries no information.
  return at.getFullYear() === now.getFullYear()
    ? DAY_AND_MONTH.format(at)
    : DAY_MONTH_AND_YEAR.format(at)
}

/** "14 Beiträge", "1 Beitrag" — the design system requires a noun beside every number. */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`
}
