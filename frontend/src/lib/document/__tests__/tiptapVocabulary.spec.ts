import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { RENDER_EXTENSIONS } from '@/lib/document/extensions'

/**
 * What Tiptap emits, pinned. The backend validates the same vocabulary in
 * `document_schema_test.ts` and holds its own copy of this document — two constants rather than one
 * shared file, because the two tests ask different questions and neither should read the other's
 * directory. They may drift; that is cheaper than a test that touches the filesystem.
 *
 * Everything is declared as HTML and asserted as JSON, so the fixture is what a **paste** produces
 * and there is no command chaining to get wrong — an earlier version applied marks by command and
 * `setCode()` silently cleared the four before it.
 *
 * When a Tiptap upgrade changes this, the failure prints the new document: read the diff, satisfy
 * yourself the change is intended, and paste it in.
 */
const EVERY_NODE_AND_MARK =
  '<h2 style="text-align: center">Überschrift</h2>' +
  '<p><strong>fett</strong> <em>kursiv</em> <u>unterstrichen</u> <s>durchgestrichen</s> ' +
  '<code>code</code> <a href="https://example.org">Link</a></p>' +
  '<ul><li><p>Punkt</p></li></ul>' +
  '<ol start="3"><li><p>Nummer</p></li></ol>' +
  '<blockquote><p>Zitat</p></blockquote>' +
  '<pre><code class="language-ts">const x = 1</code></pre>' +
  '<hr>' +
  '<p>Zeile<br>danach</p>' +
  '<img src="/api/files/karte.png" alt="Karte" title="Titel">' +
  '<table><tbody><tr><th>Kopf</th><td>Zelle</td></tr></tbody></table>' +
  '<p><span style="color: #aa3311; background-color: #f0e8d8; font-family: Newsreader; ' +
  'font-size: 18px; line-height: 1.6">gestaltet</span></p>'

const EXPECTED = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: {
        textAlign: 'center',
        level: 2,
      },
      content: [
        {
          type: 'text',
          text: 'Überschrift',
        },
      ],
    },
    {
      type: 'paragraph',
      attrs: {
        textAlign: null,
      },
      content: [
        {
          type: 'text',
          marks: [
            {
              type: 'bold',
            },
          ],
          text: 'fett',
        },
        {
          type: 'text',
          text: ' ',
        },
        {
          type: 'text',
          marks: [
            {
              type: 'italic',
            },
          ],
          text: 'kursiv',
        },
        {
          type: 'text',
          text: ' ',
        },
        {
          type: 'text',
          marks: [
            {
              type: 'underline',
            },
          ],
          text: 'unterstrichen',
        },
        {
          type: 'text',
          text: ' ',
        },
        {
          type: 'text',
          marks: [
            {
              type: 'strike',
            },
          ],
          text: 'durchgestrichen',
        },
        {
          type: 'text',
          text: ' ',
        },
        {
          type: 'text',
          marks: [
            {
              type: 'code',
            },
          ],
          text: 'code',
        },
        {
          type: 'text',
          text: ' ',
        },
        {
          type: 'text',
          marks: [
            {
              type: 'link',
              attrs: {
                href: 'https://example.org',
                target: '_blank',
                rel: 'noopener noreferrer nofollow',
                class: null,
                title: null,
              },
            },
          ],
          text: 'Link',
        },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: null,
              },
              content: [
                {
                  type: 'text',
                  text: 'Punkt',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'orderedList',
      attrs: {
        start: 3,
        type: null,
      },
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              attrs: {
                textAlign: null,
              },
              content: [
                {
                  type: 'text',
                  text: 'Nummer',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          attrs: {
            textAlign: null,
          },
          content: [
            {
              type: 'text',
              text: 'Zitat',
            },
          ],
        },
      ],
    },
    {
      type: 'codeBlock',
      attrs: {
        language: 'ts',
      },
      content: [
        {
          type: 'text',
          text: 'const x = 1',
        },
      ],
    },
    {
      type: 'horizontalRule',
    },
    {
      type: 'paragraph',
      attrs: {
        textAlign: null,
      },
      content: [
        {
          type: 'text',
          text: 'Zeile',
        },
        {
          type: 'hardBreak',
        },
        {
          type: 'text',
          text: 'danach',
        },
      ],
    },
    {
      type: 'image',
      attrs: {
        src: '/api/files/karte.png',
        alt: 'Karte',
        title: 'Titel',
        width: null,
        height: null,
      },
    },
    {
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [
            {
              type: 'tableHeader',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
                align: null,
              },
              content: [
                {
                  type: 'paragraph',
                  attrs: {
                    textAlign: null,
                  },
                  content: [
                    {
                      type: 'text',
                      text: 'Kopf',
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableCell',
              attrs: {
                colspan: 1,
                rowspan: 1,
                colwidth: null,
                align: null,
              },
              content: [
                {
                  type: 'paragraph',
                  attrs: {
                    textAlign: null,
                  },
                  content: [
                    {
                      type: 'text',
                      text: 'Zelle',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'paragraph',
      attrs: {
        textAlign: null,
      },
      content: [
        {
          type: 'text',
          marks: [
            {
              type: 'textStyle',
              attrs: {
                color: '#aa3311',
                backgroundColor: '#f0e8d8',
                fontFamily: 'Newsreader',
                fontSize: '18px',
                lineHeight: '1.6',
              },
            },
          ],
          text: 'gestaltet',
        },
      ],
    },
  ],
}

describe('the Tiptap vocabulary the backend validates', () => {
  it('still emits the document the schema is written against', () => {
    const editor = new Editor({
      // The reader's list, which is the whole vocabulary `DOCUMENT_SCHEMA` accepts.
      extensions: RENDER_EXTENSIONS,
      content: EVERY_NODE_AND_MARK,
    })

    const produced = editor.getJSON()
    editor.destroy()

    expect(produced).toEqual(EXPECTED)
  })
})
