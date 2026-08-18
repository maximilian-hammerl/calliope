/**
 * The little that the renderer needs to know about a stored document. The backend is the
 * authority on what may be in one; this only has to read what it finds without trusting it.
 */
export type PostNode = {
  type: string
  text?: string
  attrs?: { level?: number }
  marks?: Array<{ type: string; attrs?: { href?: string } }>
  content?: PostNode[]
}

/** A post as the API returns it: typed loosely, because the guarantee is on the way in. */
export function nodesOf(document: unknown): PostNode[] {
  const content = (document as { content?: unknown })?.content
  return Array.isArray(content) ? (content as PostNode[]) : []
}

export function textOf(node: PostNode): string {
  return node.text ?? ''
}

export function marksOf(node: PostNode): { bold: boolean; italic: boolean } {
  const types = new Set((node.marks ?? []).map((mark) => mark.type))
  return { bold: types.has('bold'), italic: types.has('italic') }
}

/** Schemes are checked again here: the renderer does not rely on the writer having done it. */
const SAFE_SCHEMES = ['http:', 'https:', 'mailto:']

export function linkAttributes(node: PostNode): { href: string } | undefined {
  const href = node.marks?.find((mark) => mark.type === 'link')?.attrs?.href
  if (href === undefined) {
    return undefined
  }

  try {
    return SAFE_SCHEMES.includes(new URL(href).protocol) ? { href } : undefined
  } catch {
    return undefined
  }
}

/**
 * The document's prose, mirroring `documentToText` in the backend. Used for the emptiness and
 * length checks the composer makes before sending; the server derives its own copy from the
 * document it actually stores, so the two can never drift into disagreeing about a post.
 */
export function documentText(document: unknown): string {
  const INLINE = new Set(['text', 'hardBreak'])

  function textOfNode(node: PostNode): string {
    if (node.type === 'text') return node.text ?? ''
    if (node.type === 'hardBreak') return '\n'

    const children = node.content ?? []
    const parts = children.map(textOfNode)

    // A paragraph's children are one run of prose; a list's are separate lines.
    return children.every((child) => INLINE.has(child.type))
      ? parts.join('')
      : parts.filter((part) => part.trim().length > 0).join('\n')
  }

  return nodesOf(document)
    .map(textOfNode)
    .filter((block) => block.trim().length > 0)
    .join('\n\n')
}

/**
 * What an empty composer holds. A ProseMirror `doc` must contain at least one block, so
 * `{ type: 'doc' }` alone gives an editor with nothing to put a cursor in.
 */
export const EMPTY_DOCUMENT = { type: 'doc', content: [{ type: 'paragraph' }] }

/** An editor that has been typed into and emptied again still holds one empty paragraph. */
export function isEmptyDocument(document: unknown): boolean {
  return documentText(document).trim().length === 0
}
