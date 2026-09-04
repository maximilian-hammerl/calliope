import type { ForumPermission } from '@/lib/format/forum'

/**
 * Whether this viewer may write to a row of the forum — the mirror of the backend's
 * `mayActInForum`, and one function for the same reason that is one table.
 *
 * A row cannot answer it alone: `effectiveMemberPermission` is what **members** get, deliberately,
 * so that an operator can still be shown which rows are hidden. An operator passes whatever it
 * says (#21), which is why the two arguments are needed together.
 *
 * It decides an *affordance*, never access — the API checks again, and is the only thing that
 * can refuse.
 */
export function mayWriteInForum(
  permission: ForumPermission | undefined,
  isOperator: boolean,
): boolean {
  return isOperator || permission === 'write'
}
