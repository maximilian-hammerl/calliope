import { describe, expect, it } from 'vitest'
import { leafRoute } from '@/lib/folder/treeScope'
import type { TreeScope } from '@/lib/folder/treeScope'

/**
 * A group and the public forum render the same tree from the same kinds of row (#32), so where a
 * row links is the only thing that separates them — and getting it wrong sends a reader from the
 * forum into a group, or to a route with a missing parameter.
 */
describe('leafRoute', () => {
  it('routes a group tree through the group', () => {
    expect(leafRoute({ kind: 'group', groupId: 'g1' }, { kind: 'thread', id: 't1' })).toEqual({
      name: 'thread',
      params: { groupId: 'g1', threadId: 't1' },
    })
    expect(leafRoute({ kind: 'group', groupId: 'g1' }, { kind: 'page', id: 'p1' })).toEqual({
      name: 'page',
      params: { groupId: 'g1', pageId: 'p1' },
    })
  })

  it('routes a forum tree without one, because the forum has no group', () => {
    expect(leafRoute({ kind: 'forum' }, { kind: 'thread', id: 't1' })).toEqual({
      name: 'forumThread',
      params: { threadId: 't1' },
    })
    expect(leafRoute({ kind: 'forum' }, { kind: 'page', id: 'p1' })).toEqual({
      name: 'forumPage',
      params: { pageId: 'p1' },
    })
  })

  /**
   * A tree row passes its own `TreeScope`, which carries `isOperator`; a search result passes the
   * narrower shape. Both reach the same route, which is why the two surfaces share this function.
   */
  it('takes a tree scope as well, since it never reads the extra flag', () => {
    const fromATreeRow: TreeScope = { kind: 'forum', isOperator: true }

    expect(leafRoute(fromATreeRow, { kind: 'thread', id: 't1' })).toEqual(
      leafRoute({ kind: 'forum' }, { kind: 'thread', id: 't1' }),
    )
  })
})
