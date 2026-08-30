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

/**
 * Not trimmed: a space is a legitimate character in a password.
 *
 * The minimum is the calling operation's own, so it applies where a password is *chosen* and not
 * where one is proved — registering asks for eight, signing in asks for whatever the account
 * already has. Nothing here decides that; the bound does.
 */
export function passwordSchema(bound: RangeBound, missing: string) {
  return z
    .string()
    .min(1, missing)
    .min(
      bound.minLength,
      `Das Passwort braucht mindestens ${formatCount(bound.minLength)} Zeichen.`,
    )
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
 * A name for something: a group, a thread, an idea, a conversation. Required, and bounded by the
 * input's own `maxlength` — the `max` here is the backstop for a value that arrives another way.
 */
export function titleSchema(bound: LengthBound, missing: string) {
  return z
    .string()
    .trim()
    .min(1, missing)
    .max(
      bound.maxLength,
      `Der Titel darf höchstens ${formatCount(bound.maxLength)} Zeichen lang sein.`,
    )
}

/**
 * Long text — a synopsis, a teaser, a description. **`tooLong` is a parameter** because these are
 * the fields whose names a member reads back („Die kurze Fassung", „Die ausführliche Fassung"), and
 * because prose carries no `maxlength`: the bound is said at the moment it matters rather than by
 * typing that stops dead mid-word, which is what the research asked for.
 *
 * Leaving `missing` out makes the field optional, which is what a group's description is.
 */
export function proseSchema(bound: LengthBound, tooLong: string, missing?: string) {
  const bounded = z.string().trim()
  return missing === undefined
    ? bounded.max(bound.maxLength, tooLong)
    : bounded.min(1, missing).max(bound.maxLength, tooLong)
}

/**
 * A post's body. Its own factory rather than a `proseSchema` call, because the wording is the same
 * in the composer and in the in-place editor and was written out twice.
 */
export function postSchema(bound: LengthBound, missing?: string) {
  return proseSchema(
    bound,
    `Der Beitrag ist zu lang. Er darf höchstens ${formatCount(bound.maxLength)} Zeichen haben.`,
    missing,
  )
}

/**
 * A link a reader will follow, so the scheme is checked rather than assumed — the same two schemes
 * the backend's `HREF` allows. Two refusals rather than one: not being a URL at all and being the
 * wrong kind of URL are different mistakes, and the first is by far the more common.
 */
export function httpUrlSchema(missing: string) {
  return z
    .string()
    .trim()
    .min(1, missing)
    .refine(
      (value) => URL.canParse(value),
      'Das ist keine vollständige Adresse. Sie muss mit https:// oder http:// beginnen.',
    )
    .refine(
      (value) => !URL.canParse(value) || ['http:', 'https:'].includes(new URL(value).protocol),
      'Nur Adressen mit https:// oder http:// sind möglich.',
    )
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
  const failed = firstMessage(schema.safeParse(repeat))
  if (failed !== undefined) {
    return failed
  }
  return repeat === password ? undefined : PASSWORDS_DIFFER
}

/**
 * The value a schema made of the input, for the submit that sends it. **TanStack Form does not
 * preserve a Standard Schema's output** — `onSubmit` always receives the input — so `.trim()`
 * decides what is *accepted*, never what is sent, and „ Titel " went out with its spaces until
 * this existed. Parsing in `onSubmit` is what their submission-handling guide prescribes; it
 * cannot throw, because `onSubmit` runs only once every field validated.
 *
 * Not for `passwordSchema`, which transforms nothing on purpose: a space belongs to a password.
 */
export function parsed<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return schema.parse(value) as z.output<T>
}

/**
 * The message a schema would show, for the two places that validate without a form: the composer
 * and the in-place post editor are Tiptap, not fields, and have one error line each.
 */
export function firstMessage(result: { success: boolean; error?: z.ZodError }): string | undefined {
  return result.error?.issues[0]?.message
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
