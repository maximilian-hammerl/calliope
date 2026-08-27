import type { EditorState } from '@tiptap/pm/state'

/**
 * What „Formatierung entfernen" clears: every character mark, including the five `textStyle`
 * attributes no control can reach until #81 builds them.
 *
 * **`link` is deliberately absent.** Dropping it would lose the URL, which is information rather
 * than formatting, and the link dialog has its own remove. Block types — heading, list, quote,
 * alignment — are absent for the matching reason: the control sits in the Zeichen menu.
 */
export const REMOVABLE_MARKS = ['bold', 'italic', 'underline', 'strike', 'code', 'textStyle']

/**
 * Whether anything in reach carries one of those marks.
 *
 * **Deliberately not `editor.isActive`**, which asks whether a mark covers the *whole* selection
 * and is therefore false for the very case this control exists for: two paragraphs where one is
 * bold and the other italic answered "nothing to remove".
 */
export function hasRemovableMarks(state: EditorState): boolean {
  const { empty, from, to } = state.selection

  // A collapsed cursor carries the marks it would type with, which is what the toggles read too.
  if (empty) {
    const marks = state.storedMarks ?? state.selection.$from.marks()
    return marks.some((mark) => REMOVABLE_MARKS.includes(mark.type.name))
  }

  let found = false
  state.doc.nodesBetween(from, to, (node) => {
    if (node.marks.some((mark) => REMOVABLE_MARKS.includes(mark.type.name))) found = true
    return !found
  })
  return found
}
