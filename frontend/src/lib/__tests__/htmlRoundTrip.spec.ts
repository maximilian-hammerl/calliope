import { describe, expect, it } from 'vitest'
import { Editor } from '@tiptap/vue-3'
import { postExtensions } from '../postEditor'
import { documentText, nodesOf } from '../postDocument'

/** What a source-view toggle would do: hand HTML to the same editor and read the document. */
function parse(html: string) {
  const editor = new Editor({ extensions: postExtensions(''), content: html })
  const json = editor.getJSON()
  editor.destroy()
  return json
}

const typesIn = (document: unknown): string[] => {
  const seen: string[] = []
  const walk = (nodes: ReturnType<typeof nodesOf>) => {
    for (const node of nodes) {
      seen.push(node.type)
      for (const mark of node.marks ?? []) seen.push(`mark:${mark.type}`)
      walk(node.content ?? [])
    }
  }
  walk(nodesOf(document))
  return seen
}

describe('pasting HTML into the editor', () => {
  it('keeps what the schema allows', () => {
    const types = typesIn(
      parse(
        '<h2>Kapitel</h2><p><strong>fett</strong> und <em>kursiv</em></p>' +
          '<ul><li>eins</li></ul><blockquote><p>zitiert</p></blockquote>',
      ),
    )

    expect(types).toContain('heading')
    expect(types).toContain('mark:bold')
    expect(types).toContain('mark:italic')
    expect(types).toContain('bulletList')
    expect(types).toContain('blockquote')
  })

  it('drops everything the schema does not allow', () => {
    const document = parse(
      '<p>davor</p>' +
        '<script>alert(1)</script>' +
        '<img src=x onerror="alert(1)">' +
        '<table><tr><td>zelle</td></tr></table>' +
        '<div style="position:fixed">überlagert</div>' +
        '<iframe src="https://example.test"></iframe>' +
        '<p onclick="steal()">danach</p>',
    )
    const types = typesIn(document)

    for (const forbidden of ['image', 'table', 'tableRow', 'iframe', 'script']) {
      expect(types).not.toContain(forbidden)
    }
    // The prose inside survives; the constructs around it do not.
    expect(documentText(document)).toContain('davor')
    expect(documentText(document)).toContain('danach')
    expect(JSON.stringify(document)).not.toContain('onerror')
    expect(JSON.stringify(document)).not.toContain('onclick')
    expect(JSON.stringify(document)).not.toContain('alert')
  })

  it('refuses a javascript: link while keeping its text', () => {
    const document = parse('<p><a href="javascript:alert(1)">klick</a></p>')

    expect(JSON.stringify(document)).not.toContain('javascript:')
    expect(documentText(document)).toBe('klick')
  })
})
