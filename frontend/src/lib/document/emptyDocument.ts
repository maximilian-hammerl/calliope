import type { PostDocument } from '@/api/models'

/**
 * What an untouched composer holds. Neither a document nor a text node may be empty, so this is one
 * paragraph with nothing in it.
 *
 * A function rather than a constant, because two editors are open at once — the composer and
 * whichever post is being edited in place — and a shared object would alias between them.
 */
export function emptyDocument(): PostDocument {
  return { type: 'doc', content: [{ type: 'paragraph' }] }
}
