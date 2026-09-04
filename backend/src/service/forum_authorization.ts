import type { ForumPermission } from "@/src/database/schema.ts";
import type { User } from "@/src/service/user_service.ts";
import { isOperator } from "@/src/service/forum_permission.ts";

/**
 * Who may do what in the public forum, as one table — the counterpart of
 * `writing_group_authorization.ts`, in the same shape so the two read alike.
 *
 * A group asks about the member's role; the forum asks about the row. **`write`** means the
 * governing row grants it, for making anything and for changing a page, which the forum writes
 * together rather than owns. **`author`** means whoever wrote it, and only while they may still
 * write there — the containment the group's table has, applied to a folder closing.
 * **`operator`** means nothing a member holds grants it: the forum's own shape, and the
 * permissions, which have no owner below an operator because the forum has no administrators.
 *
 * An operator passes either (#21). The moderation acts are absent on purpose: removing content is
 * #62's, and hiding or moving it is #32's operator surface.
 */
const RULE = {
  "thread:create": "write",
  "thread:change": "author",
  "thread:move": "author",

  "post:create": "write",
  "post:change": "author",
  "post:delete": "author",

  "page:create": "write",
  "page:change": "write",
  "page:move": "write",

  // The forum's shape, and the permissions themselves: no value a member holds grants any of it,
  // so these read as `false` for everybody the operator early-return does not answer.
  "folder:create": "operator",
  "folder:change": "operator",
  "folder:move": "operator",
  "folder:delete": "operator",
  "permission:change": "operator",
} as const satisfies Record<string, "write" | "author" | "operator">;

/** Not exported: a caller names an act with a literal, and the overloads check it. */
type Act = keyof typeof RULE;

/** Each rule's acts, derived from the table so the two cannot disagree. */
type AuthorAct = {
  [K in Act]: typeof RULE[K] extends "author" ? K : never;
}[Act];
type OperatorAct = {
  [K in Act]: typeof RULE[K] extends "operator" ? K : never;
}[Act];
type WriteAct = Exclude<Act, AuthorAct | OperatorAct>;

/** Who wrote the thing, and who is asking. Null once the author's account is gone. */
type Content = { createdBy: string | null; userId: string };

/**
 * Given what the governing row grants: the folder for making something in it, the thread for a
 * post, the page for an edit. A post carries no permission of its own.
 *
 * Two overloads rather than an optional argument, as the group's table has them.
 */
export function mayActInForum(user: User, act: OperatorAct): boolean;
export function mayActInForum(
  user: User,
  permission: ForumPermission,
  act: WriteAct,
): boolean;
export function mayActInForum(
  user: User,
  permission: ForumPermission,
  act: AuthorAct,
  content: Content,
): boolean;
export function mayActInForum(
  user: User,
  permissionOrAct: ForumPermission | OperatorAct,
  act?: Act,
  content?: Content,
): boolean {
  // An operator act names itself in the second position, because no row's grant bears on it.
  const named = act ?? permissionOrAct as OperatorAct;

  // The forum's equivalent of a group's administrator, and the only way in before a folder opens.
  if (isOperator(user)) {
    return true;
  }

  if (RULE[named] === "operator") {
    return false;
  }

  const permission = permissionOrAct as ForumPermission;

  if (RULE[named] === "write") {
    return permission === "write";
  }

  if (content === undefined) {
    // Unreachable through the overloads above, which is what makes this a bug rather than a case.
    throw new Error(
      `${named} is decided by its author, so it needs the content`,
    );
  }

  // Somebody who may no longer write here changes nothing, not even their own: see above.
  if (permission !== "write") {
    return false;
  }

  return content.createdBy === content.userId;
}
