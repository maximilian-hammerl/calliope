import type { ZodType } from 'zod'
import { z } from 'zod'
import { formatCount } from '@/lib/format/formatNumber'

/**
 * One declaration of each field's rules, shared by every form that asks for it.
 *
 * **The bound stays each operation's own.** `TEXT_LIMIT` is keyed by operation, and reading
 * `registerUser`'s length to validate a password-reset would be right only by luck — so each
 * factory takes the caller's own generated bound rather than picking one.
 *
 * **The wording is split on purpose.** What a field says when it is *empty* names what is being
 * asked for, and that differs per form: "Wähle ein Passwort" when registering, "Gib dein
 * aktuelles Passwort ein" when confirming who you are. What it says when it is *too long* does
 * not differ, and was written out seven times before this.
 *
 * Rules are declared in the order a member should read them: Zod collects every failing check and
 * keeps them in order, and the forms show the first.
 */

const PASSWORDS_DIFFER = 'Die Passwörter stimmen nicht überein.'

type LengthBound = { maxLength: number }
type RangeBound = { minLength: number; maxLength: number }

/** Whitespace-only counts as empty, which took `required` *and* `pattern=".*\S.*"` before. */
export function usernameSchema(bound: RangeBound) {
  return z
    .string()
    .trim()
    .min(1, 'Gib einen Benutzernamen ein.')
    .min(
      bound.minLength,
      `Der Benutzername braucht mindestens ${formatCount(bound.minLength)} Zeichen.`,
    )
    .max(
      bound.maxLength,
      `Der Benutzername darf höchstens ${formatCount(bound.maxLength)} Zeichen lang sein.`,
    )
}

/**
 * `z.regexes.html5Email` is the constant the backend's `EMAIL_ADDRESS_SCHEMA` uses, so the form
 * and the API cannot disagree about what an address is — which `type="email"` only approximated.
 */
export function emailAddressSchema(bound: LengthBound, missing: string) {
  return z
    .string()
    .trim()
    .min(1, missing)
    .max(
      bound.maxLength,
      `Die E-Mail-Adresse darf höchstens ${formatCount(bound.maxLength)} Zeichen lang sein.`,
    )
    .regex(z.regexes.html5Email, 'Das sieht nicht nach einer E-Mail-Adresse aus.')
}

/** Not trimmed: a space is a legitimate character in a password. */
export function passwordSchema(bound: LengthBound, missing: string) {
  return z
    .string()
    .min(1, missing)
    .max(
      bound.maxLength,
      `Das Passwort darf höchstens ${formatCount(bound.maxLength)} Zeichen lang sein.`,
    )
}

/** A username *or* an address, so neither format applies — length and presence only. */
export function loginSchema(bound: LengthBound, missing: string) {
  return z
    .string()
    .trim()
    .min(1, missing)
    .max(bound.maxLength, `Das darf höchstens ${formatCount(bound.maxLength)} Zeichen lang sein.`)
}

/**
 * A repeated password, checked in the order a member reads it: empty is missing before it is
 * different. **Only the repeat is marked** — the password itself is not wrong, the second field
 * disagrees with it.
 *
 * On submit rather than on change. TanStack's `onChangeListenTo` is the documented way to link two
 * fields, but it reports a mismatch while the repeat is still being typed, and this interface does
 * not nag people mid-word.
 */
export function passwordRepeatMessage(
  schema: ZodType<string>,
  repeat: string,
  password: string,
): string | undefined {
  const parsed = schema.safeParse(repeat)
  if (!parsed.success) {
    return parsed.error.issues[0]?.message
  }
  return repeat === password ? undefined : PASSWORDS_DIFFER
}

/**
 * Which of a field's reported errors to show: the first.
 *
 * Zod collects every failing check and keeps them in declaration order, so an empty username fails
 * both `min(1)` and `min(3)` — showing all of them would stack two corrections under one input,
 * where the wording is written so that the first already says everything. The order of the rules is
 * the order a member reads them.
 *
 * Nothing here unwraps the issue objects: `FieldError` already reads `.message` off them and
 * de-duplicates, so repeating that would be two copies of one job.
 */
export function firstError(errors: readonly unknown[]): Array<{ message: string | undefined }> {
  return errors.slice(0, 1) as Array<{ message: string | undefined }>
}

/**
 * Moves focus to the first field a failed submit marked, for `useForm`'s `onSubmitInvalid`.
 *
 * Without it focus stays on the button that was just pressed: a sighted member sees the red field
 * above, and somebody using a screen reader hears the first error announced and then has to hunt
 * upwards for the field it belongs to.
 *
 * Read from the DOM rather than from the form's state, because the order that matters is the order
 * the fields are *shown* in — which only the document knows.
 */
export function focusFirstInvalid(form: HTMLFormElement | null | undefined) {
  form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
}
