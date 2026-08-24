import { describe, expect, it } from 'vitest'
import type { PostDocument } from '@/api/models'
import { sameDocument } from '@/lib/document/sameDocument'

/**
 * The case this exists for: Postgres does not preserve key order in `jsonb`, so a document read
 * back from the API and the same one straight from the editor serialise differently. Comparing the
 * serialisations made an untouched post look edited.
 */
const fromEditor = {
  type: 'doc',
  content: [
    { type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'a' }] },
  ],
} as PostDocument

const sameAfterJsonb = {
  content: [
    { content: [{ text: 'a', type: 'text' }], attrs: { textAlign: null }, type: 'paragraph' },
  ],
  type: 'doc',
} as PostDocument

describe('sameDocument', () => {
  it('sees through the key order jsonb gives back', () => {
    // The thing a serialisation comparison gets wrong.
    expect(JSON.stringify(fromEditor)).not.toBe(JSON.stringify(sameAfterJsonb))
    expect(sameDocument(fromEditor, sameAfterJsonb)).toBe(true)
  })

  it('treats a defaulted attribute as the default', () => {
    const withoutAttrs = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'a' }] }],
    } as PostDocument

    expect(sameDocument(withoutAttrs, fromEditor)).toBe(true)
  })

  it('still sees a real change', () => {
    const changed = {
      type: 'doc',
      content: [
        { type: 'paragraph', attrs: { textAlign: null }, content: [{ type: 'text', text: 'b' }] },
      ],
    } as PostDocument

    expect(sameDocument(fromEditor, changed)).toBe(false)
  })

  it('sees a change of mark, which leaves the prose identical', () => {
    const bolded = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: null },
          content: [{ type: 'text', text: 'a', marks: [{ type: 'bold' }] }],
        },
      ],
    } as PostDocument

    expect(sameDocument(fromEditor, bolded)).toBe(false)
  })

  it('falls back rather than throwing on a document it cannot parse', () => {
    const broken = { type: 'doc', content: [{ type: 'nope' }] } as unknown as PostDocument

    expect(sameDocument(broken, broken)).toBe(true)
    expect(sameDocument(broken, fromEditor)).toBe(false)
  })
})
