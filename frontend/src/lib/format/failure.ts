import { ApiError } from '@/lib/api/apiFetch'
import { rateLimitMessage } from '@/lib/format/rateLimit'

/**
 * What a control says when its request failed and it has nothing more specific to offer. „Versuche
 * es später" is wrong under a rate limit — later is a number the server has already told us, and
 * trying again is what caused it — so that one case names the wait instead.
 *
 * The global notice says the same thing at the same moment, deliberately: it explains the whole
 * interface, this explains the control that was pressed.
 */
export function failureMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return rateLimitMessage(error.retryAfterSeconds)
  }
  return 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
}
