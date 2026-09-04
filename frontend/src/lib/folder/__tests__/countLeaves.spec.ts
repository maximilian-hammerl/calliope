import { describe, expect, it } from 'vitest'
import { countLeaves, findFolder } from '../countLeaves'
import type { TreeNode } from '@/lib/folder/buildTree'

const leaf = (kind: 'thread' | 'page', id: string): TreeNode => ({
  kind,
  id,
  title: id,
  lastActivityAt: '2026-09-04T10:00:00.000000+00:00',
  isFavourite: false,
  createdBy: 'u1',
  folderId: null,
})

const folder = (id: string, children: TreeNode[], depth = 1): TreeNode => ({
  kind: 'folder',
  id,
  title: id,
  description: null,
  depth,
  createdBy: 'u1',
  children,
})

describe('countLeaves', () => {
  it('counts nothing in an empty folder', () => {
    expect(countLeaves([])).toEqual({ threads: 0, pages: 0 })
  })

  it('counts the two kinds apart, because the sentence names both', () => {
    expect(countLeaves([leaf('thread', 't1'), leaf('page', 'p1'), leaf('thread', 't2')])).toEqual({
      threads: 2,
      pages: 1,
    })
  })

  /** The whole point: hiding a room hides what is nested inside it, however deep. */
  it('counts the whole subtree, not one level', () => {
    const tree = [
      folder('games', [
        leaf('thread', 't1'),
        folder('finished', [leaf('thread', 't2'), folder('summer', [leaf('page', 'p1')], 3)], 2),
      ]),
    ]

    expect(countLeaves(tree)).toEqual({ threads: 2, pages: 1 })
  })

  it('does not count the folders themselves', () => {
    expect(countLeaves([folder('empty', [folder('alsoEmpty', [], 2)])])).toEqual({
      threads: 0,
      pages: 0,
    })
  })
})

describe('findFolder', () => {
  const tree = [folder('games', [folder('finished', [leaf('thread', 't1')], 2)])]

  it('finds one nested below the top', () => {
    expect(findFolder(tree, 'finished')?.id).toBe('finished')
  })

  it('is undefined for an id that is not a folder', () => {
    expect(findFolder(tree, 't1')).toBeUndefined()
    expect(findFolder(tree, 'nope')).toBeUndefined()
  })
})
