import type { PlatformRole } from "@/src/database/schema.ts";

/**
 * Roles on the account, for the site as a whole. The group-level twin of this file is
 * `writing_group_authorization.ts`, and the two must not be confused: administering a writing
 * group is authority over that group's content and confers nothing here.
 *
 * `null` is the ordinary member, which is almost everybody, so both predicates take it.
 */

/** Moderators act on content and accounts; administrators may do everything a moderator may. */
export function mayModeratePlatform(role: PlatformRole | null): boolean {
  return role === "moderator" || role === "administrator";
}

/** Reserved for what changes the platform itself, granting a role included. */
export function mayAdministerPlatform(role: PlatformRole | null): boolean {
  return role === "administrator";
}
