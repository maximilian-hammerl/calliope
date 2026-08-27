import { describe, expect, it } from 'vitest'
import { getSchema } from '@tiptap/core'
import { Node } from '@tiptap/pm/model'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { DOCUMENT_EXTENSIONS } from '@/lib/document/extensions'
import { hasRemovableMarks } from '@/lib/document/removableMarks'

/**
 * The predicate behind „Formatierung entfernen", tested here rather than through the component
 * because the case that was wrong needs a *range* selection, and the automated browser cannot be
 * made to produce one reliably.
 *
 * What was wrong: `editor.isActive('bold')` asks whether the mark covers the whole selection, so
 * selecting one bold paragraph and one italic paragraph reported nothing to remove.
 */
const schema = getSchema(DOCUMENT_EXTENSIONS)

/** Two paragraphs, the first bold and the second italic — the reported case. */
const MIXED = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'fett', marks: [{ type: 'bold' }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'kursiv', marks: [{ type: 'italic' }] }] },
  ],
}

/**
 * Plain first, bold second. This is the case that separates walking the range from reading the
 * marks at its start — the selection begins in text carrying nothing.
 */
const PLAIN_THEN_BOLD = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'nichts' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'fett', marks: [{ type: 'bold' }] }] },
  ],
}

const PLAIN = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'nichts' }] }],
}

const LINKED = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'ein Link',
          marks: [{ type: 'link', attrs: { href: 'https://example.org' } }],
        },
      ],
    },
  ],
}

function stateFor(document: unknown, select: 'all' | 'start'): EditorState {
  const doc = Node.fromJSON(schema, document)
  const state = EditorState.create({ doc })
  if (select === 'start') return state

  return state.apply(state.tr.setSelection(TextSelection.create(doc, 1, doc.content.size - 1)))
}

describe('hasRemovableMarks', () => {
  it('finds a mark that covers only part of the selection', () => {
    // The reported bug: bold in one paragraph, italic in the next, both selected.
    expect(hasRemovableMarks(stateFor(MIXED, 'all'))).toBe(true)
  })

  it('finds a mark further into the selection than its start', () => {
    expect(hasRemovableMarks(stateFor(PLAIN_THEN_BOLD, 'all'))).toBe(true)
  })

  it('finds nothing in prose that carries nothing', () => {
    expect(hasRemovableMarks(stateFor(PLAIN, 'all'))).toBe(false)
  })

  it('does not count a link, which is not formatting', () => {
    // Removing it would lose the address, so it must not make the control look useful either.
    expect(hasRemovableMarks(stateFor(LINKED, 'all'))).toBe(false)
  })

  it('reads the marks at a collapsed cursor, with nothing selected', () => {
    // A cursor inside bold text reports bold, because that is what typing there would produce:
    // `marks()` answers about the position, not about a range.
    expect(hasRemovableMarks(stateFor(MIXED, 'start'))).toBe(true)
    expect(hasRemovableMarks(stateFor(PLAIN, 'start'))).toBe(false)
  })
})
