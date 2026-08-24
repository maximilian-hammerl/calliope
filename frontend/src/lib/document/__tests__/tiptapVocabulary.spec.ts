import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/core'
import { DOCUMENT_EXTENSIONS } from '@/lib/document/extensions'
import { EVERY_NODE_AND_MARK, EXPECTED } from '@/lib/document/__tests__/documentFixture'

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

describe('the Tiptap vocabulary the backend validates', () => {
  it('still emits the document the schema is written against', () => {
    const editor = new Editor({
      // The reader's list, which is the whole vocabulary `DOCUMENT_SCHEMA` accepts.
      extensions: DOCUMENT_EXTENSIONS,
      content: EVERY_NODE_AND_MARK,
    })

    const produced = editor.getJSON()
    editor.destroy()

    expect(produced).toEqual(EXPECTED)
  })
})
