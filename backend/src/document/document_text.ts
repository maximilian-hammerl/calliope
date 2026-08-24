/**
 * The prose of a document, which is what `writing_post.text` holds.
 *
 * Written here and never accepted from the client, the rule `report_service.ts` states for its
 * excerpt: three things read a post as text — `ILIKE` search, the report excerpt and the length
 * limit — and a client-supplied projection could disagree with the document it claims to describe.
 *
 * The output is shaped like what a member typed into a textarea, blocks separated by blank lines,
 * so `paragraphs()` on the frontend and both readers on this side keep working unchanged.
 */
import type {
  DocumentNode,
  PostDocument,
} from "@/src/document/document_schema.ts";

/**
 * Blocks that hold inline content and become one paragraph of the projection. Everything else with
 * children is a container and is recursed into.
 *
 * The container case is not decoration: this used to filter a node's children to a set of known
 * block types, which meant a **nested** list was neither a known block nor recursed into, so its
 * text vanished from the projection — unsearchable, absent from the moderation excerpt, and
 * uncounted against the length limit.
 */
const LEAF_BLOCKS = new Set(["paragraph", "heading", "codeBlock"]);

function inlineText(node: DocumentNode): string {
  switch (node.type) {
    case "text":
      return node.text ?? "";
    case "hardBreak":
      return "\n";
    // An image's alt is metadata rather than prose, so it stays out of the body text.
    case "image":
    case "horizontalRule":
      return "";
    default:
      return (node.content ?? []).map(inlineText).join("");
  }
}

function blocks(node: DocumentNode): string[] {
  if (LEAF_BLOCKS.has(node.type)) {
    const text = inlineText(node).trim();
    return text.length > 0 ? [text] : [];
  }

  if (node.type === "tableRow") {
    // A row reads as one line, or a table becomes a paragraph per cell. A cell may hold several
    // blocks of its own, which run together with a space rather than disappearing.
    const cells = (node.content ?? [])
      .map((cell) => blocks(cell).join(" ").trim())
      .filter((cell) => cell.length > 0);
    return cells.length > 0 ? [cells.join("\t")] : [];
  }

  return (node.content ?? []).flatMap(blocks);
}

export function documentToPlainText(document: DocumentNode): string {
  return blocks(document).join("\n\n");
}

/**
 * The inverse, for the two places prose still arrives as plain text: the seed fixtures, which are
 * written as paragraphs with blank lines, and `test/support.ts`'s `postBody`, so a test can say
 * what it writes rather than carry a node tree.
 *
 * Nothing in the application calls it — the composer sends a document — so it is not the frontend's
 * counterpart to anything. The frontend's own text-to-document helper was deleted when the editor
 * replaced the textarea.
 */
export function plainTextToDocument(text: string): PostDocument {
  const paragraphs = text
    .split(/\n{2,}/u)
    .map((block) => block.trim())
    .filter((block) => block.length > 0);

  return {
    type: "doc",
    // A `doc` may not be empty and neither may a `text` node, so an empty string becomes one
    // paragraph holding nothing rather than no content at all.
    content: paragraphs.length === 0 ? [{ type: "paragraph" }] : paragraphs.map(
      (block) => ({
        type: "paragraph",
        content: [{ type: "text", text: block }],
      }),
    ),
  };
}
