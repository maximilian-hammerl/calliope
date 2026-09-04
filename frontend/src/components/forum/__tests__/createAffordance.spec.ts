import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import FolderTreeNode from '@/components/folder/FolderTreeNode.vue'
import type { TreeNode } from '@/lib/folder/buildTree'
import type { ForumPermission } from '@/lib/format/forum'
import { START_FORUM_CREATE } from '@/lib/folder/treeScope'
import type { TreeScope } from '@/lib/folder/treeScope'

const stubs = {
  RouterLink: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('a', slots.default?.()),
  }),
  FavouriteMark: true,
  ForumPermissionMark: true,
  DropdownMenuContent: true,
  CreateKindItems: true,
}

const folder = (permission?: ForumPermission): TreeNode => ({
  kind: 'folder',
  id: 'f1',
  title: 'Ankündigungen',
  description: null,
  depth: 1,
  createdBy: 'u1',
  effectiveMemberPermission: permission,
  children: [],
})

const leaf = (permission?: ForumPermission): TreeNode => ({
  kind: 'thread',
  id: 't1',
  title: 'Wortkette',
  lastActivityAt: '2026-09-03T10:00:00.000000+00:00',
  isFavourite: false,
  createdBy: 'u1',
  folderId: 'f1',
  effectiveMemberPermission: permission,
})

/** `provide` present means the forum's own page; absent is the rail, which offers nothing. */
function offersCreate(node: TreeNode, scope: TreeScope, editable = true): boolean {
  const wrapper = mount(FolderTreeNode, {
    props: { node, scope, collapsed: new Set<string>() },
    global: {
      stubs,
      provide: editable ? { [START_FORUM_CREATE as symbol]: () => undefined } : {},
    },
  })
  return wrapper.find('[aria-label="In Ankündigungen anlegen"]').exists()
}

const forum = (isOperator: boolean): TreeScope => ({ kind: 'forum', isOperator })

describe('the „+" appears where the viewer may actually create', () => {
  it('offers it in a folder members may write in', () => {
    expect(offersCreate(folder('write'), forum(false))).toBe(true)
  })

  it('withholds it from a member where the folder is read-only', () => {
    expect(offersCreate(folder('read'), forum(false))).toBe(false)
  })

  /**
   * Slice 7 gave an operator its own menu, which also makes a folder — so this „+" is a member's,
   * and an operator's row carries the structure one below instead. Two on a row would be the same
   * button twice, with only one of them able to make a room.
   */
  it('withholds the member menu from an operator, whose own offers more', () => {
    expect(offersCreate(folder('read'), forum(true))).toBe(false)
    expect(offersCreate(folder('write'), forum(true))).toBe(false)
  })

  it('gives an operator the structure menu instead, which a member never sees', () => {
    const structureMenu = (scope: TreeScope) =>
      mount(FolderTreeNode, {
        props: { node: folder('write'), scope, collapsed: new Set<string>() },
        global: { stubs, provide: { [START_FORUM_CREATE as symbol]: () => undefined } },
      })
        .find('[aria-label="In diesem Ordner anlegen"]')
        .exists()

    expect(structureMenu(forum(true))).toBe(true)
    expect(structureMenu(forum(false))).toBe(false)
  })

  it('never offers it on a leaf, which holds nothing', () => {
    expect(offersCreate(leaf('write'), forum(true))).toBe(false)
  })

  it('offers nothing without a handler — which is what the read-only rail passes', () => {
    expect(offersCreate(folder('write'), forum(true), false)).toBe(false)
  })

  it('offers nothing in a writing group, whose tree carries its own actions', () => {
    // A folder that would qualify in the forum, so the scope is the only thing refusing it.
    expect(offersCreate(folder('write'), { kind: 'group', groupId: 'g1' })).toBe(false)
  })
})

/**
 * The delete button asked the group's own `mayWrite`, which the forum never passes — so an
 * operator had every control but that one, and no way to remove a room they had just made.
 */
describe('the delete button follows the same rule as the rest of the structure', () => {
  const deleteButton = (node: TreeNode, scope: TreeScope, mayWrite?: boolean) =>
    mount(FolderTreeNode, {
      props: { node, scope, collapsed: new Set<string>(), mayWrite },
      global: { stubs, provide: { [START_FORUM_CREATE as symbol]: () => undefined } },
    })
      .find('[aria-label="Ordner löschen"]')
      .exists()

  it('is offered to an operator on an empty room', () => {
    expect(deleteButton(folder('write'), forum(true))).toBe(true)
  })

  it('is withheld from a member, whatever the room grants', () => {
    expect(deleteButton(folder('write'), forum(false))).toBe(false)
  })

  it('still follows a group writer, which is where the rule came from', () => {
    expect(deleteButton(folder(), { kind: 'group', groupId: 'g1' }, true)).toBe(true)
    expect(deleteButton(folder(), { kind: 'group', groupId: 'g1' }, false)).toBe(false)
  })
})
