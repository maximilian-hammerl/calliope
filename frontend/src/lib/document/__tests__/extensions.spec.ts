import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { DOCUMENT_EXTENSIONS } from '@/lib/document/extensions'

/**
 * The editor has to be able to *hold* everything the schema accepts, not only what it has controls
 * for. ProseMirror drops a document it cannot parse in full, so an editor missing one node type
 * opens a post containing it as an empty paragraph — and saving then destroys the prose around it.
 *
 * These are the two shapes with no controls today: a table, and the `textStyle` marks #81 will add.
 * Both round-tripped as nothing while the editor used a narrower list than the schema.
 */
function roundTrip(document: unknown): unknown {
  const editor = new Editor({
    extensions: DOCUMENT_EXTENSIONS,
    content: document as never,
  })
  const json = editor.getJSON()
  editor.destroy()
  return json
}

describe('DOCUMENT_EXTENSIONS', () => {
  it('keeps a table, and the prose around it', () => {
    const stored = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Davor' }] },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Zelle' }] }],
                },
              ],
            },
          ],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Danach' }] },
      ],
    }

    const text = JSON.stringify(roundTrip(stored))

    expect(text).toContain('table')
    expect(text).toContain('Zelle')
    expect(text).toContain('Davor')
    expect(text).toContain('Danach')
  })

  it('keeps a colour mark it has no control for', () => {
    const stored = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'farbig',
              marks: [{ type: 'textStyle', attrs: { color: '#aa3311' } }],
            },
          ],
        },
      ],
    }

    const text = JSON.stringify(roundTrip(stored))

    expect(text).toContain('#aa3311')
    expect(text).toContain('farbig')
  })

  it('keeps an image, which only #31 will be able to create', () => {
    const stored = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '/api/files/karte.png' } }],
    }

    expect(JSON.stringify(roundTrip(stored))).toContain('/api/files/karte.png')
  })
})
