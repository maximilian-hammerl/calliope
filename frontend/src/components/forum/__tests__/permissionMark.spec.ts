import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import FolderRailNode from '@/components/context/FolderRailNode.vue'
import type { TreeNode } from '@/lib/folder/buildTree'
import type { ForumPermission } from '@/lib/format/forum'
import type { TreeScope } from '@/lib/folder/treeScope'

const stubs = {
  RouterLink: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('a', slots.default?.()),
  }),
  FavouriteMark: true,
}

const leaf = (permission?: ForumPermission): TreeNode => ({
  kind: 'thread',
  id: 't1',
  title: 'Entwurf: Winterwettbewerb',
  lastActivityAt: '2026-09-03T10:00:00.000000+00:00',
  isFavourite: false,
  createdBy: 'u1',
  folderId: null,
  effectiveMemberPermission: permission,
})

const forum = (isOperator: boolean): TreeScope => ({ kind: 'forum', isOperator })

function marksIn(node: TreeNode, scope: TreeScope): string[] {
  const wrapper = mount(FolderRailNode, { props: { node, scope }, global: { stubs } })
  return wrapper.findAll('[role="img"]').map((mark) => mark.attributes('aria-label') ?? '')
}

/**
 * The response answers what *members* may do, whoever asked — it used to answer `write` for an
 * operator, which left nothing able to say a folder was hidden from everyone else. These pin the
 * two halves of the fix: the value reaches the row, and only an operator is shown it.
 */
describe('the forum marks what members may do, for operators only', () => {
  it('names a hidden row, so a moderator cannot mistake it for a published one', () => {
    expect(marksIn(leaf('hidden'), forum(true))).toEqual(['Für Mitglieder verborgen'])
  })

  it('names a read-only row', () => {
    expect(marksIn(leaf('read'), forum(true))).toEqual(['Mitglieder können nur lesen'])
  })

  it('marks nothing where members may write, which is the ordinary case', () => {
    expect(marksIn(leaf('write'), forum(true))).toEqual([])
  })

  it('marks nothing for a member, whose own view is already the answer', () => {
    expect(marksIn(leaf('hidden'), forum(false))).toEqual([])
    expect(marksIn(leaf('read'), forum(false))).toEqual([])
  })

  it('marks nothing in a group, which has no permissions at all', () => {
    expect(marksIn(leaf(undefined), { kind: 'group', groupId: 'g1' })).toEqual([])
  })
})
