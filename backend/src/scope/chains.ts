import type { MiddlewareHandler } from "hono";
import authenticated from "@/src/middleware/authenticated.ts";
import {
  folderInGroup,
  joinedGroup,
  memberOfGroup,
  pageInGroup,
  postInThread,
  stepInGroup,
  threadInGroup,
  visibleGroup,
} from "@/src/scope/group_scope.ts";
import {
  forumFolder,
  forumPage,
  forumThread,
} from "@/src/scope/forum_scope.ts";

/**
 * A route's whole middleware, one per path shape. Each resolver reads the one before it, and the
 * compiler cannot see a link left out — so the order is written here once, not in every route.
 * `VISIBLE_` reads a group anybody may see; `JOINED_` writes and needs a joined membership.
 */

/**
 * The list as the route takes it: each handler's own type, in order — what `as const` keeps —
 * but a mutable tuple, since `createRoute` refuses a readonly one held in a variable.
 */
// deno-lint-ignore no-explicit-any -- a middleware of any context, as `createRoute` accepts
function chain<const T extends MiddlewareHandler<any>[]>(...middleware: T): T {
  return middleware;
}

export const VISIBLE_GROUP = chain(authenticated, visibleGroup);
export const JOINED_GROUP = chain(authenticated, joinedGroup);

export const VISIBLE_GROUP_THREAD = chain(
  authenticated,
  visibleGroup,
  threadInGroup,
);
export const JOINED_GROUP_THREAD = chain(
  authenticated,
  joinedGroup,
  threadInGroup,
);

export const VISIBLE_GROUP_POST = chain(
  authenticated,
  visibleGroup,
  threadInGroup,
  postInThread,
);
export const JOINED_GROUP_POST = chain(
  authenticated,
  joinedGroup,
  threadInGroup,
  postInThread,
);

export const VISIBLE_GROUP_PAGE = chain(
  authenticated,
  visibleGroup,
  pageInGroup,
);
export const JOINED_GROUP_PAGE = chain(authenticated, joinedGroup, pageInGroup);

export const JOINED_GROUP_FOLDER = chain(
  authenticated,
  joinedGroup,
  folderInGroup,
);

export const JOINED_GROUP_STEP = chain(authenticated, joinedGroup, stepInGroup);

/** Visible, not joined: leaving and declining are one's own membership, whatever one's role. */
export const VISIBLE_GROUP_MEMBER = chain(
  authenticated,
  visibleGroup,
  memberOfGroup,
);

export const FORUM_THREAD = chain(authenticated, forumThread);
export const FORUM_POST = chain(authenticated, forumThread, postInThread);
export const FORUM_PAGE = chain(authenticated, forumPage);
export const FORUM_FOLDER = chain(authenticated, forumFolder);
