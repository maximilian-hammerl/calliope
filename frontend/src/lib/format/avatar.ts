import { SetAvatarBodyOrigin } from '@/api/models'

/**
 * Where a picture came from, in the member's words. From the generated enum rather than literals,
 * so a value renamed in the backend breaks compilation here instead of showing a blank radio.
 */
export const AVATAR_ORIGIN_LABELS: Record<SetAvatarBodyOrigin, string> = {
  [SetAvatarBodyOrigin.own_work]: 'Mein eigenes Bild',
  [SetAvatarBodyOrigin.licence]: 'Lizenz oder Creative Commons',
  [SetAvatarBodyOrigin.permission]: 'Ich habe die Erlaubnis des Urhebers',
  [SetAvatarBodyOrigin.public_domain]: 'Gemeinfrei',
  [SetAvatarBodyOrigin.other]: 'Andere rechtmäßige Grundlage',
}

/** The one case that needs nothing further, which is why it is also the default. */
export const OWN_WORK = SetAvatarBodyOrigin.own_work

export const AVATAR_ORIGINS = Object.keys(AVATAR_ORIGIN_LABELS) as Array<SetAvatarBodyOrigin>

/**
 * What went wrong, in words a member can act on. The three the route can answer, plus whatever
 * `failureMessage` already says about a rate limit or a schema drift.
 */
export const AVATAR_TOO_LARGE = 'Das Bild ist zu groß. Bis zu 4 MB kannst du hochladen.'
export const AVATAR_NOT_AN_IMAGE =
  'Das konnten wir nicht als Bild lesen. JPEG, PNG und WebP funktionieren.'
export const AVATAR_NEEDS_CREDIT = 'Sag noch, woher das Bild stammt.'
