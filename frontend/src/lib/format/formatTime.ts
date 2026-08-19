/**
 * Relative under a day, absolute above it: "vor 12 Minuten" → "Dienstag, 09:14" → "12. Februar".
 * The design system fixes this ladder, so it lives in one place rather than at each call site.
 *
 * Everything here comes from Intl rather than a date library: it already knows German plurals
 * and month names, and switching this constant is most of what localising these strings takes.
 * A library would earn its place once times have to be shown in a zone other than the reader's,
 * or once differences have to be counted in calendar days rather than elapsed milliseconds.
 */
const LOCALE = 'de-DE'

const RELATIVE = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'always' })

const WEEKDAY_AND_TIME = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  hour: '2-digit',
  minute: '2-digit',
})

const DAY_AND_MONTH = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'long' })

const DAY_MONTH_AND_YEAR = new Intl.DateTimeFormat(LOCALE, {
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

  // A clock that is slightly behind the server must not produce "in 3 Sekunden", and Intl
  // would render the sub-minute case as "vor 0 Minuten".
  if (elapsed < MINUTE) {
    return 'gerade eben'
  }
  if (elapsed < HOUR) {
    return RELATIVE.format(-Math.floor(elapsed / MINUTE), 'minute')
  }
  if (elapsed < DAY) {
    return RELATIVE.format(-Math.floor(elapsed / HOUR), 'hour')
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
