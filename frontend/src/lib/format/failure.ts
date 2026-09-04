import { ApiError } from '@/lib/api/apiFetch'
import { rateLimitMessage } from '@/lib/format/rateLimit'

/** Said on the field: this password is *known*, which is not a judgement about the member. */
export const PASSWORD_BREACHED_MESSAGE =
  'Dieses Passwort steht in bekannten Datenlecks. Wähle bitte ein anderes.'

/**
 * What a control says when its request failed and it has nothing more specific to offer. „Versuche
 * es später" is wrong under a rate limit — later is a number the server has already told us, and
 * trying again is what caused it — so that one case names the wait instead.
 *
 * A **400 is the schema drift case**: every form validates through the same rules the API enforces,
 * so a refusal on the shape means the deployed client and server disagree. Reloading is the only
 * thing a member can do about it, and six forms each said so in their own copy of the sentence.
 *
 * `fallback` is for the controls that name what failed — „Die Anmeldung ist gerade nicht möglich".
 * Without one it is the generic sentence, which is what most of them want.
 *
 * The global notice says the same thing at the same moment, deliberately: it explains the whole
 * interface, this explains the control that was pressed.
 */
export function failureMessage(error: unknown, fallback?: string): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return rateLimitMessage(error.retryAfterSeconds)
    }
    if (error.status === 400) {
      return 'Die Angaben sind nicht gültig. Lade die Seite neu und versuche es noch einmal.'
    }
  }
  return fallback ?? 'Das ist gerade nicht möglich. Versuche es später noch einmal.'
}
