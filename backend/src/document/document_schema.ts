/**
 * What a post's body may contain: the Tiptap document, as a closed Zod allowlist.
 *
 * Every node type, mark type and attribute name here was read off `editor.getJSON()` rather than
 * from documentation — `document_schema_test.ts` holds that fixture, and it is what fails when
 * Tiptap is upgraded. The stored shape is the library's, so an extension renaming an attribute is
 * a data migration, which is why the version is pinned exactly.
 *
 * **Unknown node types, mark types and attributes are all rejected, not stripped** — every object
 * here is `z.strictObject`. That is the whole reason this is JSON rather than HTML, and it is the
 * property to preserve when editing: a plain `z.object` *strips* what it does not know, silently
 * turning a refusal into a quiet acceptance. `grep -c 'z\.object(' ` on this file must stay 0,
 * which is a cheaper check than reading for a trailing `.strict()` on thirty-one closing braces.
 *
 * One trap, because it cost a day: a **recursive type in a response** sends
 * `@hono/zod-openapi`'s route generics into TS2589, whose message names neither the schema nor
 * the route. It was never this schema — it was kysely's recursive `Json`, arriving through a
 * column picked off the generated table type. `jsonb` now generates as `unknown` instead, so the
 * trap is closed at the source; see the `typeMapping` note in `database/.kysely-codegenrc.ts`.
 */
import { z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";

/** A tree costs nothing to send and plenty to walk, so both dimensions are bounded. */
const MAX_DEPTH = 20;
const MAX_NODES = 10_000;

// Free values, so each is a real predicate rather than `z.string()`. Nothing here is ever
// interpolated into CSS — the renderer binds them as style properties — but a value that cannot
// be a colour has no business being stored as one.
const COLOUR = z.string().regex(
  /^(#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/i,
  "Not a hex or rgb() colour",
).nullish();

/** A family name or a fallback list, and nothing that could close a declaration. */
const FONT_FAMILY = z.string().min(1).max(200).regex(
  /^[\w\s,'"-]+$/u,
  "Not a font family list",
).nullish();

const FONT_SIZE = z.string().regex(
  /^\d{1,3}(\.\d+)?(px|pt|rem|em|%)$/,
  "Not a length",
).nullish();

/** Unitless, as the editor emits it, and bounded: a line height of 400 is a denial of layout. */
const LINE_HEIGHT = z.string()
  .regex(/^\d(\.\d+)?$/, "Not a line height")
  .refine(
    (value) => Number(value) >= 0.5 && Number(value) <= 4,
    "Line height out of range",
  )
  .nullish();

const TEXT_ALIGN = z.enum(["left", "center", "right", "justify"]).nullish();
const SAFE_TOKEN = z.string().max(100).regex(/^[\w\s-]*$/u).nullish();

/**
 * The one place JSON storage does *not* remove the injection risk: a link is a URL the reader's
 * browser will follow, so the scheme is an allowlist. `javascript:` and `data:` are what this
 * refuses; `mailto:` is refused too, because a forum post is not where an address belongs.
 *
 * Note the protocol is matched **without** its colon — `/^https?:$/` would reject every URL.
 */
const HREF = z.url({ protocol: /^https?$/ }).max(2_000);

/** Relative only until #31 gives an image somewhere to live. */
const IMAGE_SRC = z.string().max(2_000).regex(
  /^\/[\w\-./]*$/u,
  "Only a relative path",
);

/** One `textStyle` mark carries all five, which is how Tiptap models them — not a mark each. */
const MARK_SCHEMA = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("bold") }),
  z.strictObject({ type: z.literal("italic") }),
  z.strictObject({ type: z.literal("underline") }),
  z.strictObject({ type: z.literal("strike") }),
  z.strictObject({ type: z.literal("code") }),
  z.strictObject({
    type: z.literal("link"),
    attrs: z.strictObject({
      href: HREF,
      target: z.enum(["_blank", "_self"]).nullish(),
      rel: SAFE_TOKEN,
      class: SAFE_TOKEN,
      title: z.string().max(500).nullish(),
    }),
  }),
  z.strictObject({
    type: z.literal("textStyle"),
    attrs: z.strictObject({
      color: COLOUR,
      backgroundColor: COLOUR,
      fontFamily: FONT_FAMILY,
      fontSize: FONT_SIZE,
      lineHeight: LINE_HEIGHT,
    }),
  }),
]);

/** `colwidth` is a pixel width per spanned column, which is why it is a list and not a number. */
const CELL_ATTRIBUTES = z.strictObject({
  colspan: z.int().min(1).max(100).nullish(),
  rowspan: z.int().min(1).max(100).nullish(),
  colwidth: z.array(z.int().min(1).max(10_000)).max(100).nullish(),
  align: TEXT_ALIGN,
}).optional();

/** `text` and `hardBreak` are the inline nodes, and ProseMirror lets either carry marks. */
const INLINE_MARKS = z.array(MARK_SCHEMA).max(20).optional();

/** The shape the recursion is annotated with, or inference never terminates. */
export type DocumentNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocumentNode[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

/**
 * `z.lazy` defers the body to first use, or the self-reference below reads a `const` still being
 * defined — a `ReferenceError` at import. The annotation breaks the separate *type* cycle:
 * without it the union infers as `any`, and every route goes on validating while silently losing
 * its document typing. Both parameters, or the input type stays `unknown` and a parsed body
 * disagrees with the schema that produced it.
 *
 * A `get content()` per branch defers just as well, but a self-referential *union* still needs
 * the annotation — only a plain object infers without one — so it buys eleven deferral sites and
 * nothing else.
 */
const NODE_SCHEMA: z.ZodType<DocumentNode, DocumentNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({
      type: z.literal("text"),
      // A text node with no text is not something the editor produces.
      text: z.string().min(1),
      marks: INLINE_MARKS,
    }),
    z.strictObject({
      type: z.literal("paragraph"),
      attrs: z.strictObject({ textAlign: TEXT_ALIGN }).optional(),
      content: z.array(NODE_SCHEMA).optional(),
    }),
    z.strictObject({
      type: z.literal("heading"),
      // `textAlign` is a block attribute in Tiptap, not a mark — see the fixture.
      attrs: z.strictObject({
        level: z.int().min(1).max(6),
        textAlign: TEXT_ALIGN,
      })
        .strict(),
      content: z.array(NODE_SCHEMA).optional(),
    }),
    z.strictObject({
      type: z.literal("bulletList"),
      content: z.array(NODE_SCHEMA).optional(),
    }),
    z.strictObject({
      type: z.literal("orderedList"),
      attrs: z.strictObject({
        start: z.int().min(1).max(10_000).nullish(),
        type: z.enum(["a", "A", "i", "I", "1"]).nullish(),
      }).optional(),
      content: z.array(NODE_SCHEMA).optional(),
    }),
    z.strictObject({
      type: z.literal("listItem"),
      content: z.array(NODE_SCHEMA).optional(),
    }),
    z.strictObject({
      type: z.literal("blockquote"),
      content: z.array(NODE_SCHEMA).optional(),
    }),
    z.strictObject({
      type: z.literal("codeBlock"),
      attrs: z.strictObject({ language: SAFE_TOKEN }).optional(),
      content: z.array(NODE_SCHEMA).optional(),
    }),
    z.strictObject({ type: z.literal("horizontalRule") }),
    z.strictObject({ type: z.literal("hardBreak"), marks: INLINE_MARKS }),
    z.strictObject({
      type: z.literal("image"),
      attrs: z.strictObject({
        src: IMAGE_SRC,
        alt: z.string().max(1_000).nullish(),
        title: z.string().max(500).nullish(),
        width: z.int().min(1).max(10_000).nullish(),
        height: z.int().min(1).max(10_000).nullish(),
      }),
    }),
    z.strictObject({
      type: z.literal("table"),
      content: z.array(NODE_SCHEMA).optional(),
    }),
    z.strictObject({
      type: z.literal("tableRow"),
      content: z.array(NODE_SCHEMA).optional(),
    }),
    z.strictObject({
      type: z.literal("tableHeader"),
      attrs: CELL_ATTRIBUTES,
      content: z.array(NODE_SCHEMA).optional(),
    }),
    z.strictObject({
      type: z.literal("tableCell"),
      attrs: CELL_ATTRIBUTES,
      content: z.array(NODE_SCHEMA).optional(),
    }),
  ])
  // Named at the recursion point, not only on the document: an unnamed cycle sends
  // zod-to-openapi into infinite inlining, which is a stack overflow rather than an error.
).openapi("DocumentNode");

/** Counts nodes and depth in one walk, so a pathological tree is refused rather than walked twice. */
function withinBounds(
  node: DocumentNode,
  depth: number,
  counted: { nodes: number },
): boolean {
  if (depth > MAX_DEPTH) {
    return false;
  }

  counted.nodes += 1;
  if (counted.nodes > MAX_NODES) {
    return false;
  }

  return (node.content ?? []).every((child) =>
    withinBounds(child, depth + 1, counted)
  );
}

/**
 * `maxLength` bounds the *extracted prose*, not the serialisation, and is declared so it reaches
 * `src/api/textLimit.ts` — the interface has to be able to say a post is too long before sending
 * one. The route enforces it, since only the route can extract the text.
 */
export const DOCUMENT_SCHEMA = z.strictObject({
  type: z.literal("doc"),
  content: z.array(NODE_SCHEMA).min(1),
})
  .refine(
    (document) => withinBounds(document, 0, { nodes: 0 }),
    `A document may not nest deeper than ${MAX_DEPTH} or hold more than ${MAX_NODES} nodes`,
  )
  .openapi("PostDocument", { maxLength: TEXT_LIMIT.postText });

export type PostDocument = z.infer<typeof DOCUMENT_SCHEMA>;

/**
 * The node and mark types this schema accepts, read back out of the schema itself.
 *
 * It exists to prove the direction the conformance fixture cannot. The fixture shows the editor
 * *can produce* every type here; this shows the schema *accepts nothing beyond* them. Together they
 * close the gap that would otherwise only surface as a thrown render: a type the schema allowed and
 * the frontend's extensions could not make would reach `PostBody`, which renders without a guard.
 *
 * Reading Zod's own structure means casting through it. That is deliberate — a Zod version that
 * moved `options` or `unwrap` breaks the test that uses this, which is exactly where it should be
 * noticed rather than in a silent empty list.
 */
function branchNames(union: unknown): string[] {
  const options = (union as { options?: unknown[] }).options ?? [];

  return options
    .map((branch) =>
      (branch as { shape?: { type?: { value?: unknown } } }).shape?.type?.value
    )
    .filter((name): name is string => typeof name === "string")
    .toSorted();
}

export const DOCUMENT_VOCABULARY = {
  // `doc` is the document itself rather than a branch of the node union, so it is named here.
  nodes: [
    "doc",
    ...branchNames(
      (NODE_SCHEMA as unknown as { unwrap: () => unknown }).unwrap(),
    ),
  ].toSorted(),
  marks: branchNames(MARK_SCHEMA),
};
