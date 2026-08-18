import { z } from "@hono/zod-openapi";

/**
 * A post is stored as a ProseMirror document rather than markup, and this is the whitelist
 * that keeps it one: a document is only valid if every node and mark in it appears below.
 * Nothing else can be stored, so nothing else can come back out — the guarantee is structural
 * rather than a sanitising step somebody has to remember to run.
 *
 * The shape has to match what the editor produces, but the two are deliberately not shared
 * code: this is the API's contract, and it should fail loudly if the editor ever starts
 * sending something new rather than quietly widening to fit.
 */

/** Anything else — `javascript:`, `data:` — is a script waiting to be clicked. */
const LINK_SCHEMES = ["http:", "https:", "mailto:"];

function hasSafeScheme(href: string): boolean {
  try {
    return LINK_SCHEMES.includes(new URL(href).protocol);
  } catch {
    // Relative or malformed: no scheme to trust, so not a link we will store.
    return false;
  }
}

/**
 * Deep enough for a quote inside a list inside a quote, far short of what it takes to make
 * the recursive renderer or this validator work hard.
 */
const MAXIMUM_DEPTH = 10;

const MARK = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({
    type: z.literal("link"),
    attrs: z.object({
      href: z.string().max(2_048).refine(hasSafeScheme, {
        message: "Only http, https and mailto links are allowed",
      }),
    }),
  }),
]);

const TEXT_NODE = z.object({
  type: z.literal("text"),
  // ProseMirror has no empty text nodes; one would render as nothing and only add depth.
  text: z.string().min(1),
  marks: z.array(MARK).optional(),
});

const HARD_BREAK = z.object({ type: z.literal("hardBreak") });

const INLINE_NODE = z.union([TEXT_NODE, HARD_BREAK]);

/**
 * Blocks nest, so the schema does too. Zod cannot infer a recursive type on its own, hence
 * the explicit one; the getter keeps the reference lazy.
 */
export type BlockNode =
  | { type: "paragraph"; content?: Array<z.infer<typeof INLINE_NODE>> }
  | {
    type: "heading";
    attrs: { level: 2 | 3 };
    content?: Array<z.infer<typeof INLINE_NODE>>;
  }
  | { type: "blockquote"; content?: Array<BlockNode> }
  | { type: "bulletList"; content?: Array<BlockNode> }
  | { type: "orderedList"; content?: Array<BlockNode> }
  | { type: "listItem"; content?: Array<BlockNode> };

const BLOCK_NODE: z.ZodType<BlockNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("paragraph"),
      content: z.array(INLINE_NODE).optional(),
    }),
    z.object({
      type: z.literal("heading"),
      // Only two levels: the post already sits under a thread title and an author line, and
      // the reading column is 684px. A third would be a distinction nobody could see.
      attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }),
      content: z.array(INLINE_NODE).optional(),
    }),
    z.object({
      type: z.literal("blockquote"),
      content: z.array(BLOCK_NODE).optional(),
    }),
    z.object({
      type: z.literal("bulletList"),
      content: z.array(BLOCK_NODE).optional(),
    }),
    z.object({
      type: z.literal("orderedList"),
      content: z.array(BLOCK_NODE).optional(),
    }),
    z.object({
      type: z.literal("listItem"),
      content: z.array(BLOCK_NODE).optional(),
    }),
  ])
);

export type PostDocument = { type: "doc"; content?: Array<BlockNode> };

function depthOf(node: unknown, depth = 1): number {
  const content = (node as { content?: Array<unknown> }).content;
  if (content === undefined || content.length === 0) {
    return depth;
  }
  return Math.max(...content.map((child) => depthOf(child, depth + 1)));
}

export const DOCUMENT_SCHEMA = z
  .object({
    type: z.literal("doc"),
    content: z.array(BLOCK_NODE).optional(),
  })
  .refine((document) => depthOf(document) <= MAXIMUM_DEPTH, {
    message: `A document may not nest deeper than ${MAXIMUM_DEPTH} levels`,
  });

/**
 * The document's prose, with no markup in it. Stored alongside the document so that search
 * matches what a member wrote rather than what the editor wrapped it in, and so the length
 * limit counts characters somebody actually typed.
 *
 * Blocks are separated by a blank line and a hard break by a newline, which is roughly how
 * the same text reads on screen.
 */
export function documentToText(document: PostDocument): string {
  const INLINE = new Set(["text", "hardBreak"]);

  function textOfNode(node: unknown): string {
    const typed = node as
      & { type: string; text?: string }
      & { content?: Array<{ type: string }> };

    if (typed.type === "text") {
      return typed.text ?? "";
    }
    if (typed.type === "hardBreak") {
      return "\n";
    }

    const children = typed.content ?? [];
    const parts = children.map(textOfNode);

    // A paragraph's children are one run of prose; a list's are separate lines. Joining both
    // the same way ran list items together, so "Laternen" and "Steckbriefe" became one word
    // and neither could be searched for.
    return children.every((child) => INLINE.has(child.type))
      ? parts.join("")
      : parts.filter((part) => part.trim().length > 0).join("\n");
  }

  return (document.content ?? [])
    .map(textOfNode)
    .filter((block) => block.trim().length > 0)
    .join("\n\n");
}

/**
 * The document body every write endpoint takes: valid against the whitelist, and holding
 * between one character of prose and the post limit once the markup is taken out. Counting
 * the derived text rather than the JSON means the bound is what a member typed, not how the
 * editor happened to wrap it.
 *
 * The declared type is the hand-written {@link PostDocument} rather than the recursive Zod
 * schema's inferred one: composed into a route, that inference makes TypeScript give up with
 * "type instantiation is excessively deep". Validation is unaffected — the strict schema
 * still runs, and the transform returns its output, so unknown attributes are stripped here
 * rather than reaching a handler.
 */
export function documentBodySchema(maximumLength: number) {
  const withLength = DOCUMENT_SCHEMA.superRefine((document, context) => {
    const length = documentToText(document).length;

    if (length === 0) {
      context.addIssue({ code: "custom", message: "A post may not be empty" });
    } else if (length > maximumLength) {
      context.addIssue({
        code: "custom",
        message: `A post may hold at most ${maximumLength} characters`,
      });
    }
  });

  return z
    .custom<Record<string, unknown>>()
    .superRefine((value, context) => {
      const result = withLength.safeParse(value);
      if (!result.success) {
        context.addIssue({
          code: "custom",
          message: result.error.issues[0]?.message ?? "Invalid document",
        });
      }
    })
    .openapi({
      type: "object",
      description: "A ProseMirror document",
      // The bound is on the prose inside the document, so it is not a JSON Schema maxLength
      // on any field. Published as an extension so the frontend's generated limits still
      // carry it and the interface can say the number out loud.
      "x-max-text-length": maximumLength,
    });
}

/**
 * The validated document, with everything outside the whitelist stripped. Safe to call on a
 * body that already passed {@link documentBodySchema}; it is the same parse, kept out of the
 * route's type so the recursion never reaches Hono's inference.
 */
export function parseDocument(value: unknown): PostDocument {
  return DOCUMENT_SCHEMA.parse(value) as PostDocument;
}
