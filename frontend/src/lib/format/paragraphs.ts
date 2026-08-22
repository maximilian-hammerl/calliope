/**
 * Long-form prose as the paragraphs a member typed. A plain textarea carries them as blank
 * lines, and a single `<p>` would render an eight-thousand-character synopsis as one wall.
 * Shared by the post and the story idea, which are the two places members write at length.
 */
export function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}
