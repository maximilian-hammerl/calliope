import { Dropcursor, Gapcursor, Placeholder, UndoRedo } from '@tiptap/extensions'
import { Image } from '@tiptap/extension-image'
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import {
  BackgroundColor,
  Color,
  FontFamily,
  FontSize,
  LineHeight,
  TextStyle,
} from '@tiptap/extension-text-style'
import { Blockquote } from '@tiptap/extension-blockquote'
import { Bold } from '@tiptap/extension-bold'
import { Code } from '@tiptap/extension-code'
import { CodeBlock } from '@tiptap/extension-code-block'
import { Document } from '@tiptap/extension-document'
import { HardBreak } from '@tiptap/extension-hard-break'
import { Heading } from '@tiptap/extension-heading'
import { HorizontalRule } from '@tiptap/extension-horizontal-rule'
import { Italic } from '@tiptap/extension-italic'
import { Link } from '@tiptap/extension-link'
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list'
import { Paragraph } from '@tiptap/extension-paragraph'
import { Strike } from '@tiptap/extension-strike'
import { Text } from '@tiptap/extension-text'
import { TextAlign } from '@tiptap/extension-text-align'
import { Underline } from '@tiptap/extension-underline'

/**
 * The whole vocabulary `DOCUMENT_SCHEMA` accepts — one list, used to edit, to render, and to build
 * the conformance fixture.
 *
 * **It is deliberately not "what the composer has controls for".** It was that once, and the
 * consequence was silent data loss: ProseMirror drops a document it cannot parse *in full*, so an
 * editor without `Table` opened a post containing one as an empty paragraph, and saving destroyed
 * the prose around it too. A control a member does not have is a missing button; a node type the
 * editor cannot hold is a lost post. `__tests__/extensions.spec.ts` holds that line.
 *
 * Loading `Image` before #31 has one cost, and it is paid at the parse rule below rather than here.
 *
 * The alignment types are the two block nodes that have the attribute in the schema. Adding a
 * third here without adding it there produces documents the API rejects.
 */
export const DOCUMENT_EXTENSIONS = [
  // Behaviour rather than vocabulary: these add no node or mark, so they cannot widen what the
  // API has to accept. `UndoRedo` is not optional — a textarea gets undo from the browser, and a
  // contenteditable without a history plugin has none at all.
  UndoRedo,
  Dropcursor,
  Gapcursor,
  Placeholder.configure({ placeholder: 'Schreib weiter \u2026' }),
  Document,
  Paragraph.configure({ HTMLAttributes: { class: 'prose-post' } }),
  Text,
  Bold,
  Italic,
  Underline,
  Strike,
  Code.configure({ HTMLAttributes: { class: 'rounded bg-paper-3 px-1 font-mono text-[0.9em]' } }),
  CodeBlock.configure({
    HTMLAttributes: { class: 'overflow-x-auto rounded-lg bg-paper-3 p-3.5 font-mono text-note' },
  }),
  Blockquote.configure({ HTMLAttributes: { class: 'border-l-2 border-line-5 pl-3.5 text-ink-3' } }),
  Heading.configure({
    levels: [2, 3],
    HTMLAttributes: { class: 'font-serif text-h2 text-ink-1' },
  }),
  BulletList.configure({ HTMLAttributes: { class: 'list-disc pl-5' } }),
  OrderedList.configure({ HTMLAttributes: { class: 'list-decimal pl-5' } }),
  ListItem.configure({ HTMLAttributes: { class: 'prose-post' } }),
  HardBreak,
  HorizontalRule.configure({ HTMLAttributes: { class: 'my-[1.2em] border-line-3' } }),
  // No `HTMLAttributes` here, unlike the others: Link declares `class` as a document *attribute*,
  // so a class set that way is stored in every link. Links are styled from the wrapper instead.
  Link.configure({ openOnClick: false }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  // No control makes these yet, but the schema accepts them, so the editor must be able to hold
  // them — see the note above.
  // A relative `src` only: an external one is refused on save, which jams the composer.
  Image.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg' } }).extend({
    parseHTML: () => [{ tag: 'img[src^="/"]' }],
  }),
  Table.configure({ HTMLAttributes: { class: 'w-full border-collapse text-note' } }),
  TableRow,
  TableHeader.configure({
    HTMLAttributes: { class: 'border border-line-3 px-2 py-1 text-left font-semibold' },
  }),
  TableCell.configure({ HTMLAttributes: { class: 'border border-line-3 px-2 py-1' } }),
  TextStyle,
  Color,
  BackgroundColor,
  FontFamily,
  FontSize,
  LineHeight,
]
