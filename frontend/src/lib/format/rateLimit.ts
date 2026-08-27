/**
 * The one wording for having asked too often, and the one place that turns `Retry-After` into a
 * wait a member can read. Four sign-in views each wrote their own sentence before this, and two of
 * them had already drifted apart.
 */
const MINUTE_SECONDS = 60

/**
 * Rounded up, so the wait is never understated: told "in 1 Minute" at 61 seconds, a member tries
 * again too early and spends another request on a refusal.
 */
export function rateLimitWait(retryAfterSeconds: number | undefined): string | undefined {
  if (retryAfterSeconds === undefined || retryAfterSeconds <= 0) {
    return undefined
  }

  if (retryAfterSeconds < MINUTE_SECONDS) {
    return retryAfterSeconds === 1 ? 'in einer Sekunde' : `in ${retryAfterSeconds} Sekunden`
  }

  const minutes = Math.ceil(retryAfterSeconds / MINUTE_SECONDS)
  return minutes === 1 ? 'in einer Minute' : `in ${minutes} Minuten`
}

/**
 * „Zu viele Anfragen" rather than naming the limit: the number is the platform's business, and a
 * member who reads "300 pro 15 Minuten" learns only that they cannot fix it.
 */
export function rateLimitMessage(retryAfterSeconds?: number): string {
  const wait = rateLimitWait(retryAfterSeconds)
  return wait === undefined
    ? 'Zu viele Anfragen. Versuche es in einigen Minuten noch einmal.'
    : `Zu viele Anfragen. Versuche es ${wait} noch einmal.`
}
