import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { PostDocument } from '@/api/models'
import PostBody from '@/components/thread/PostBody.vue'

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

  it('renders empty rather than throwing on a document it cannot understand', () => {
    // Deliberately outside the type: this is the case where a stored document predates the
    // vocabulary the renderer knows.
    const html = render({
      type: 'doc',
      content: [{ type: 'unbekannt' }],
    } as unknown as PostDocument)

    expect(html).toContain('div')
    expect(html).not.toContain('unbekannt')
  })
})
