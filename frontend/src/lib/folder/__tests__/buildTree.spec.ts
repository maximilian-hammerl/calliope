import { describe, expect, it } from 'vitest'
import { buildTree } from '@/lib/folder/buildTree'
import type { TreeFolder } from '@/lib/folder/buildTree'
import type {
  ListFolders200ResultsItem,
  ListPages200ResultsItem,
  ListThreads200ResultsItem,
} from '@/api/models'

const folder = (
  id: string,
  title: string,
  parentFolderId: string | null,
  depth: number,
): ListFolders200ResultsItem => ({
  id,
  writingGroupId: 'g',
  parentFolderId,
  depth,
  title,
  description: null,
  createdBy: 'u',
  createdAt: '2026-09-01T10:00:00.000000+00:00',
  createdByUsername: 'federkiel',
})

const thread = (
  id: string,
  title: string,
  folderId: string | null,
  lastActivityAt: string,
): ListThreads200ResultsItem => ({
  id,
  writingGroupId: 'g',
  title,
  folderId,
  createdBy: 'u',
  createdAt: '2026-09-01T10:00:00.000000+00:00',
  lastActivityAt,
  createdByUsername: 'federkiel',
  isFavourite: false,
})

const page = (
  id: string,
  title: string,
  folderId: string | null,
  lastActivityAt: string,
): ListPages200ResultsItem => ({
  id,
  writingGroupId: 'g',
  title,
  folderId,
  createdBy: 'u',
  createdAt: '2026-09-01T10:00:00.000000+00:00',
  lastActivityAt,
  updatedBy: null,
  createdByUsername: 'federkiel',
  updatedByUsername: null,
  isFavourite: false,
})

const at = (minute: number) => `2026-09-02T10:${String(minute).padStart(2, '0')}:00.000000+00:00`

/** Titles by level, so a failure reads as a shape rather than as a list of ids. */
function shapeOf(nodes: ReturnType<typeof buildTree>, indent = ''): string[] {
  return nodes.flatMap((node) => [
    `${indent}${node.title}`,
    ...(node.kind === 'folder' ? shapeOf(node.children, `${indent}  `) : []),
  ])
}

describe('buildTree', () => {
  it('nests folders under their parent, to any allowed depth', () => {
    const tree = buildTree(
      [
        folder('f1', 'Weltenbau', null, 1),
        folder('f2', 'Stadt A', 'f1', 2),
        folder('f3', 'Viertel', 'f2', 3),
        folder('f4', 'Figuren', null, 1),
      ],
      [page('p1', 'Kino', 'f3', at(1))],
      [],
    )

    expect(shapeOf(tree)).toEqual([
      'Weltenbau',
      '  Stadt A',
      '    Viertel',
      '      Kino',
      'Figuren',
    ])
  })

  it('puts threads and pages above folders, so an introduction reads first', () => {
    const tree = buildTree(
      [folder('f1', 'Weltenbau', null, 1)],
      [],
      [thread('t1', 'Ankunft', null, at(1))],
    )

    expect(shapeOf(tree)).toEqual(['Ankunft', 'Weltenbau'])
  })

  it('orders leaves by activity and folders by creation', () => {
    // The folders arrive in creation order, which is the order they must keep.
    const tree = buildTree(
      [folder('f1', 'Zuerst', null, 1), folder('f2', 'Dann', null, 1)],
      [page('p1', 'Alte Seite', null, at(1))],
      [thread('t1', 'Neues Thema', null, at(9))],
    )

    expect(shapeOf(tree)).toEqual(['Neues Thema', 'Alte Seite', 'Zuerst', 'Dann'])
  })

  it('interleaves threads and pages by activity rather than by kind', () => {
    const tree = buildTree(
      [],
      [page('p1', 'Seite mittig', null, at(5))],
      [thread('t1', 'Thema neu', null, at(9)), thread('t2', 'Thema alt', null, at(1))],
    )

    expect(shapeOf(tree)).toEqual(['Thema neu', 'Seite mittig', 'Thema alt'])
  })

  it('keeps what the rows carry, including a favourite and a description', () => {
    const described = { ...folder('f1', 'Weltenbau', null, 1), description: 'Der Norden.' }
    const favourited = { ...thread('t1', 'Ankunft', null, at(1)), isFavourite: true }

    const tree = buildTree([described], [], [favourited])

    expect(tree[0]).toMatchObject({ kind: 'thread', isFavourite: true })
    expect(tree[1]).toMatchObject({
      kind: 'folder',
      description: 'Der Norden.',
      createdBy: 'u',
      depth: 1,
    })
  })

  it('hoists a row to the root when its parent is not in the list yet', () => {
    // Three lists are three queries: one can refresh before another, and a page whose folder is
    // not loaded yet must still be visible somewhere.
    const tree = buildTree(
      [folder('f2', 'Waise', 'noch-nicht-geladen', 2)],
      [page('p1', 'Verwaiste Seite', 'noch-nicht-geladen', at(1))],
      [],
    )

    expect(shapeOf(tree)).toEqual(['Verwaiste Seite', 'Waise'])
  })

  it('is empty for a group with nothing in it', () => {
    expect(buildTree([], [], [])).toEqual([])
  })

  it('does not share child arrays between folders', () => {
    const tree = buildTree([folder('f1', 'Eins', null, 1), folder('f2', 'Zwei', null, 1)], [], [])

    const [first, second] = tree as TreeFolder[]
    expect(first?.children).not.toBe(second?.children)
  })

  /**
   * Two leaves created in one statement share a timestamp to the microsecond — three of the
   * seed's four pages do. Without a tiebreaker their order is whatever the API returned, which
   * is unspecified; `id` is uuidv7, so descending reads as newest first.
   */
  it('breaks a tie on the id, so the order is the same every time', () => {
    const moment = at(5)
    const older = page('01a00000-0000-7000-8000-00000000000a', 'Älter', null, moment)
    const middle = page('01a00000-0000-7000-8000-00000000000b', 'Mittig', null, moment)
    const newest = page('01a00000-0000-7000-8000-00000000000c', 'Neuer', null, moment)

    // Whatever order the list arrives in, the tree reads the same way: newest id first.
    expect(shapeOf(buildTree([], [older, middle, newest], []))).toEqual([
      'Neuer',
      'Mittig',
      'Älter',
    ])
    expect(shapeOf(buildTree([], [middle, newest, older], []))).toEqual([
      'Neuer',
      'Mittig',
      'Älter',
    ])
  })

  /**
   * A cycle cannot come from the API: a folder's parent is set against its own subtree under a
   * lock, and a create only ever attaches a childless row. This records what one would do if it
   * arrived anyway — **nothing renders**, rather than the walk recursing until the stack gives
   * out. Every member of a cycle has its parent inside the cycle, so none is hoisted to the root
   * and the recursion never enters it. No guard is needed for that reason, and this test is what
   * says so.
   */
  it('makes a cycle unreachable rather than hanging', () => {
    const tree = buildTree(
      [folder('f1', 'Eins', 'f2', 1), folder('f2', 'Zwei', 'f1', 2)],
      [page('p1', 'Kino', 'f1', at(1))],
      [],
    )

    // Both folders, and the page inside one of them, are simply not there.
    expect(tree).toEqual([])
  })
})
