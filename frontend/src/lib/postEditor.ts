import Blockquote from '@tiptap/extension-blockquote'
import Bold from '@tiptap/extension-bold'
import Document from '@tiptap/extension-document'
import HardBreak from '@tiptap/extension-hard-break'
import Heading from '@tiptap/extension-heading'
import Italic from '@tiptap/extension-italic'
import Link from '@tiptap/extension-link'
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { Placeholder, UndoRedo } from '@tiptap/extensions'

/**
 * The editor's schema, assembled one extension at a time rather than from StarterKit.
 *
 * StarterKit would bring headings at every level, code, code blocks, strike, underline and
 * horizontal rules — none of which the API accepts. A document containing them would be
 * refused on save, so the editor must not be able to produce one in the first place: this
 * list and the whitelist in the backend's `document.ts` are the same decision, written twice
 * on purpose, and the server is the one that counts.
 */
export function postExtensions(placeholder: string) {
  return [
    Document,
    Paragraph,
    Text,
    Bold,
    Italic,
    // Two levels only: a post already sits under a thread title and an author line.
    Heading.configure({ levels: [2, 3] }),
    BulletList,
    OrderedList,
    ListItem,
    Blockquote,
    HardBreak,
    Link.configure({
      // Typing or pasting an address makes it a link; there is no toolbar button and so no
      // dialog to design. The schemes match what the API will store — anything else is
      // dropped here rather than refused on save.
      autolink: true,
      openOnClick: false,
      protocols: ['http', 'https', 'mailto'],
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    UndoRedo,
    Placeholder.configure({ placeholder }),
  ]
}
