import type { ForumPermission } from "@/src/database/schema.ts";
import type { User } from "@/src/service/user_service.ts";

/**
 * What a leaf with no folder above it gets — #32's „only operators create by default", as a
 * constant rather than a column. It clamps a root *leaf* and never a folder: every folder
 * descends from the root, so clamping folders would put `write` out of reach everywhere.
 */
export const FORUM_ROOT_PERMISSION: ForumPermission = "read";

/** `hidden < read < write`, so the most restrictive is the smallest. */
const RANK = {
  hidden: 0,
  read: 1,
  write: 2,
} as const satisfies Record<ForumPermission, number>;

/** #32's rule: the most restrictive setting on the path wins, so nothing can widen its parent. */
export function mostRestrictive(
  ...permissions: ReadonlyArray<ForumPermission>
): ForumPermission {
  return permissions.reduce((left, right) =>
    RANK[left] <= RANK[right] ? left : right
  );
}

/** Their access is the role, not a folder's setting (#21) — unrelated to a group's roles. */
export function isOperator(user: User): boolean {
  return user.platformRole !== null;
}

/**
 * What a **member** may do with one row, from its own setting and its folder's reduced one — null
 * at the root. A join rather than a walk, because the folder stores the reduced value.
 *
 * Says nothing about who is asking: an operator's own access is `platform_role`, and answering for
 * them here would leave nothing able to say a folder is hidden from everyone else.
 */
export function effectiveMemberPermission(
  own: ForumPermission,
  folderEffective: ForumPermission | null,
): ForumPermission {
  return mostRestrictive(own, folderEffective ?? FORUM_ROOT_PERMISSION);
}

/**
 * `hidden` answers 404 rather than 403, so „may not see" and „does not exist" are one answer. An
 * operator is not held to it, here or in the queries' own filter.
 */
export function mayReadForumContent(
  user: User,
  own: ForumPermission,
  folderEffective: ForumPermission | null,
): boolean {
  return isOperator(user) ||
    effectiveMemberPermission(own, folderEffective) !== "hidden";
}
