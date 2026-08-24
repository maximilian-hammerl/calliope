import type { PostDocument } from '@/api/models'

/**
 * Every node and mark the format allows, as HTML in and as the document Tiptap makes of it.
 *
 * Not a `.spec.ts`, so vitest does not collect it: two specs use it, one asserting the editor still
 * emits this and one asserting it can be rendered. The backend holds its own copy for asserting
 * that the schema accepts it — see the note there on why the two may drift.
 *
 * Declared as HTML rather than built by chaining commands, so the fixture is what a **paste**
 * produces and there is no command order to get wrong.
 */
export const EVERY_NODE_AND_MARK =
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

export const EXPECTED = {
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
} satisfies PostDocument
