import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { PostDocument } from '@/api/models'
import PostBody from '@/components/thread/PostBody.vue'
import { EXPECTED } from '@/lib/document/__tests__/documentFixture'

/**
 * `PostBody` is the application's only `v-html`, so what it refuses to turn into markup is the part
 * worth pinning. Its source is always a document the API validated, but that is an argument about
 * the schema; these are the properties of the renderer itself.
 */
function render(document: PostDocument): string {
  return mount(PostBody, { props: { document } }).html()
}

function paragraph(text: string): PostDocument {
  return { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }
}

describe('PostBody', () => {
  it('renders prose that looks like markup as prose', () => {
    const html = render(paragraph('<img src=x onerror=alert(1)> und <script>alert(2)</script>'))

    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;img')
  })

  it('keeps a mark as an element and its text as text', () => {
    const html = render({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '<b>nicht fett</b>', marks: [{ type: 'bold' }] }],
        },
      ],
    })

    expect(html).toContain('<strong')
    expect(html).toContain('&lt;b&gt;')
  })

  it('carries the design system classes from the same definition the editor uses', () => {
    expect(render(paragraph('Absatz'))).toContain('class="prose-post"')
  })

  it('renders the parts of the format the composer cannot produce yet', () => {
    const html = render({
      type: 'doc',
      content: [
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
      ],
    })

    // A stored table has to reach the screen even though no control makes one.
    expect(html).toContain('<table')
    expect(html).toContain('Zelle')
  })

  it('renders every node and mark the format allows', () => {
    // `PostBody` does not guard `generateHTML`, and this is one half of what keeps that safe: every
    // type in the fixture renders. The other half is the backend's "the schema accepts nothing the
    // fixture does not carry", which is what stops the schema growing past these extensions.
    const html = render(EXPECTED)

    for (const element of [
      '<h2',
      '<ul',
      '<ol',
      '<blockquote',
      '<pre',
      '<hr',
      '<br',
      '<img',
      '<table',
      '<strong',
      '<em',
      '<u',
      '<s>',
      '<code',
      '<a ',
    ]) {
      expect(html, `missing ${element}`).toContain(element)
    }
  })
})
