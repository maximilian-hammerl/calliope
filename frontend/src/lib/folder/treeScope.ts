import type { InjectionKey } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

/**
 * Which tree this is. A group and the forum render the same rows (#32); where a row's link goes is
 * decided here rather than in each node.
 */
export type TreeScope =
  | { kind: 'group'; groupId: string }
  /**
   * One flag for two things a row cannot work out: whether to show the permission mark, which is
   * noise to a member, and whether to offer the „+" where members may not write (#21).
   */
  | { kind: 'forum'; isOperator: boolean }

/** Where a write goes, and all `leafRoute` needs. Narrower than {@link TreeScope}. */
export type WriteScope = { kind: 'group'; groupId: string } | { kind: 'forum' }

/**
 * Where a leaf lives, for a tree row and for a search result alike. Takes the narrower
 * {@link WriteScope}, because nothing here needs to know who is asking — a `TreeScope` is
 * assignable to it, so both callers pass what they already have.
 */
export function leafRoute(
  scope: WriteScope,
  leaf: { kind: 'thread' | 'page'; id: string },
): RouteLocationRaw {
  if (scope.kind === 'forum') {
    return leaf.kind === 'thread'
      ? { name: 'forumThread', params: { threadId: leaf.id } }
      : { name: 'forumPage', params: { pageId: leaf.id } }
  }

  return leaf.kind === 'thread'
    ? { name: 'thread', params: { groupId: scope.groupId, threadId: leaf.id } }
    : { name: 'page', params: { groupId: scope.groupId, pageId: leaf.id } }
}

/** What the „+" on a forum row starts. Null is the forum's root. */
export type StartForumCreate = (kind: 'thread' | 'page', folderId: string | null) => void

/**
 * Provided by the editable tree, injected by its rows: a recursive component cannot emit upwards
 * without every level re-emitting. Absent in the read-only rail, so no row needs a flag.
 */
export const START_FORUM_CREATE = Symbol('startForumCreate') as InjectionKey<StartForumCreate>
