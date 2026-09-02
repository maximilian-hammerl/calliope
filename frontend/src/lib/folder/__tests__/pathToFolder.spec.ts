import { describe, expect, it } from 'vitest'
import { pathToFolder } from '@/lib/folder/pathToFolder'
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

const tree: TreeNode[] = [
  folder('f1', 'Figuren', [folder('f2', 'Weltenbau', [folder('f3', 'Stadt A')])]),
  folder('f4', 'Anderes'),
]

describe('pathToFolder', () => {
  it('names every folder from the root down', () => {
    expect(pathToFolder(tree, 'f3')).toEqual(['Figuren', 'Weltenbau', 'Stadt A'])
  })

  it('is just the folder itself at the top level', () => {
    expect(pathToFolder(tree, 'f4')).toEqual(['Anderes'])
  })

  it('is empty for a folder the tree does not hold', () => {
    // What a reader sees for a moment after somebody else moves or deletes it.
    expect(pathToFolder(tree, 'gone')).toEqual([])
  })
})
