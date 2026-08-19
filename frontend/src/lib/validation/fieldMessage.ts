/** The ways a field can be wrong. `tooShort` and `tooLong` only apply where a bound is set. */
export type FieldMessages = {
  missing: string
  malformed: string
  tooShort?: string
  tooLong?: string
}

/**
 * Picks the wording for whatever the browser found wrong, in the order a member would read
 * it: an empty field is missing before it is too short.
 *
 * Length needs its own wording because the fallback is actively misleading — an over-long
 * username used to report "Gib einen Benutzernamen ein." next to the name the member had
 * just typed.
 */
export function fieldMessage(messages: FieldMessages, validity: ValidityState): string {
  if (validity.valueMissing) {
    return messages.missing
  }
  if (validity.tooShort) {
    return messages.tooShort ?? messages.malformed
  }
  if (validity.tooLong) {
    return messages.tooLong ?? messages.malformed
  }
  return messages.malformed
}

export const PASSWORDS_DIFFER = 'Die Passwörter stimmen nicht überein.'
