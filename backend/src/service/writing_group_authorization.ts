import type { UserInWritingGroupRole } from "@/src/database/schema.ts";

/** Readers may only read; writers and administrators may add threads and posts. */
export function mayWrite(role: UserInWritingGroupRole): boolean {
  return role === "writer" || role === "administrator";
}

/**
 * Content may be changed or removed by an administrator of the group, or by whoever
 * wrote it. `createdBy` is null once its author's account is gone, which leaves the
 * content to the administrators.
 */
export function mayModify(
  role: UserInWritingGroupRole,
  createdBy: string | null,
  userId: string,
): boolean {
  return role === "administrator" || createdBy === userId;
}
