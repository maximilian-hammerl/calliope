import { describe, expect, it } from 'vitest'
import { moveTargets } from '@/lib/folder/moveTargets'
import type { TreeNode } from '@/lib/folder/buildTree'

const folder = (id: string, title: string, children: TreeNode[] = []): TreeNode => ({
  kind: 'folder',
  id,
  title,
  description: null,
  depth: 1,
  createdBy: 'u',
  children,
})

const leaf = (id: string, title: string): TreeNode => ({
  kind: 'thread',
  id,
  title,
  lastActivityAt: '2026-09-02T10:00:00.000000+00:00',
  isFavourite: false,
  createdBy: 'u',
  folderId: null,
})

const tree: TreeNode[] = [
  leaf('t1', 'Ankunft'),
  folder('f1', 'Weltenbau', [
    leaf('t2', 'Abend im Kino'),
    folder('f2', 'Stadt A', [folder('f3', 'Viertel')]),
  ]),
  folder('f4', 'Figuren'),
]

describe('moveTargets', () => {
  it('offers the root first, then every folder in reading order, indented', () => {
    expect(moveTargets(tree)).toEqual([
      { id: null, title: 'Oberste Ebene', level: 0 },
      { id: 'f1', title: 'Weltenbau', level: 1 },
      { id: 'f2', title: 'Stadt A', level: 2 },
      { id: 'f3', title: 'Viertel', level: 3 },
      { id: 'f4', title: 'Figuren', level: 1 },
    ])
  })

  it('leaves threads and pages out: only a folder can hold something', () => {
    expect(moveTargets(tree).map((t) => t.title)).not.toContain('Ankunft')
  })

  it('drops a folder and everything inside it, so it cannot move into itself', () => {
    expect(moveTargets(tree, 'f1').map((t) => t.id)).toEqual([null, 'f4'])
  })

  it('offers only the root when the group has no folders', () => {
    expect(moveTargets([leaf('t1', 'Ankunft')])).toEqual([
      { id: null, title: 'Oberste Ebene', level: 0 },
    ])
  })
})
