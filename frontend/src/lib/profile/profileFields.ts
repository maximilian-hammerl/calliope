import { TEXT_LIMIT } from '@/api/textLimit'

/**
 * One list, walked by both the form and the profile page, so the two cannot drift. „Bevorzugte"
 * is in the labels and not the keys: a column on `user` is that member's own already.
 */
export const PROFILE_FIELDS = [
  {
    key: 'aboutMe',
    label: 'Über mich',
    description: 'Was andere über dich wissen sollten, bevor ihr zusammen schreibt.',
  },
  {
    key: 'writingStyle',
    label: 'Bevorzugte Schreibweise',
    description: 'Erste oder dritte Person, Vergangenheit oder Gegenwart, dein Ton.',
  },
  {
    key: 'postLength',
    label: 'Bevorzugte Beitragslänge',
    description: 'Wie lang deine Beiträge am liebsten sind.',
  },
  {
    key: 'writingFrequency',
    label: 'Bevorzugte Schreibhäufigkeit',
    description: 'Wie oft du am liebsten schreibst — und wann du eher nicht dazu kommst.',
  },
  {
    key: 'coWriterExpectations',
    label: 'Erwartungen an Mitschreibende',
    description: 'Was du dir von der anderen Seite wünschst.',
  },
  {
    key: 'writingBoundaries',
    label: 'NO-GOs beim Schreiben',
    description: 'Themen und Szenen, die du nicht schreiben möchtest.',
  },
  {
    key: 'genres',
    label: 'Lieblingsgenres',
    description: 'Worin du am liebsten schreibst.',
  },
] as const

export type ProfileField = (typeof PROFILE_FIELDS)[number]
export type ProfileFieldKey = ProfileField['key']

/** The API's own bounds, so the form cannot disagree with what the server will accept. */
export const PROFILE_LIMIT = TEXT_LIMIT.updateOwnProfile

/** Empty values are the resting state, so a profile with nothing filled in shows nothing. */
export function answeredFields(
  profile: Partial<Record<ProfileFieldKey, string | null>>,
): ReadonlyArray<ProfileField & { value: string }> {
  return PROFILE_FIELDS.flatMap((field) => {
    const value = profile[field.key]?.trim()
    return value === undefined || value === '' ? [] : [{ ...field, value }]
  })
}
