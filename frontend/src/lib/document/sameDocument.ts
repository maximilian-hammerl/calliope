import { getSchema } from '@tiptap/core'
import { Node } from '@tiptap/pm/model'
import type { PostDocument } from '@/api/models'
import { DOCUMENT_EXTENSIONS } from '@/lib/document/extensions'

/** Built once: deriving it per comparison is the expensive half. */
let schema: ReturnType<typeof getSchema> | undefined

/**
 * Whether two documents say the same thing.
 *
 * **Not `JSON.stringify` on both sides.** Postgres does not preserve key order in `jsonb`, so a
 * document read back from the API and the same one from `getJSON()` serialise differently while
 * being identical — which made an untouched post look edited. ProseMirror's own `Node.eq` compares
 * the tree, and normalising through the schema also settles attributes one side spells out and the
 * other leaves to a default.
 *
 * A document the schema cannot parse falls back to comparing the serialisations: wrong in the same
 * way it was before, but only for a document that is already broken, and never throwing at a call
 * site that only wanted to know whether Speichern should light up.
 */
export function sameDocument(a: PostDocument, b: PostDocument): boolean {
  schema ??= getSchema(DOCUMENT_EXTENSIONS)

  try {
    return Node.fromJSON(schema, a).eq(Node.fromJSON(schema, b))
  } catch {
    return JSON.stringify(a) === JSON.stringify(b)
  }
}
