/**
 * The avatar letter. Avatars are initials on paper, never generated images, so this is the
 * whole of it — one grapheme, so an umlaut or an emoji-adjacent first character stays intact
 * rather than being cut in half by charAt.
 */
export function userInitial(username: string): string {
  const [first] = [...username.trim()]
  return (first ?? '').toLocaleUpperCase('de')
}
