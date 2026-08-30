import type { ListUsers200ResultsItemPlatformRole } from '@/api/models'

/**
 * A role on the platform, not inside one group — „Admin" in a group's member list is a different
 * thing and stays that word. Function nouns rather than Moderator/Moderatorin, for the reason the
 * group roles are „Admin", „Schreibt" and „Liest": nothing knows the person's grammatical gender.
 */
const PLATFORM_ROLE_LABELS = {
  moderator: 'Moderation',
  administrator: 'Administration',
} as const satisfies Record<NonNullable<ListUsers200ResultsItemPlatformRole>, string>

/** Undefined for an ordinary member, which is most of them, so a caller can `v-if` on it. */
export function platformRoleLabel(
  role: ListUsers200ResultsItemPlatformRole | undefined,
): string | undefined {
  return role === null || role === undefined ? undefined : PLATFORM_ROLE_LABELS[role]
}
