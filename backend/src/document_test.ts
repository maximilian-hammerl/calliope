import { assert, assertEquals, assertFalse } from "@std/assert";
import { type BlockNode, DOCUMENT_SCHEMA, documentToText } from "./document.ts";

const accepts = (document: unknown) =>
  DOCUMENT_SCHEMA.safeParse(document).success;

function paragraph(text: string): BlockNode {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

Deno.test("a document of the allowed nodes and marks is accepted", () => {
  assert(accepts({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Kapitel" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "fett", marks: [{ type: "bold" }] },
          { type: "text", text: "kursiv", marks: [{ type: "italic" }] },
          { type: "hardBreak" },
          {
            type: "text",
            text: "ein Verweis",
            marks: [{
              type: "link",
              attrs: { href: "https://example.test/a" },
            }],
          },
        ],
      },
      { type: "blockquote", content: [paragraph("zitiert")] },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [paragraph("eins")] }],
      },
      {
        type: "orderedList",
        content: [{ type: "listItem", content: [paragraph("zwei")] }],
      },
      { type: "paragraph" },
    ],
  }));
});

Deno.test("a node outside the whitelist is refused", () => {
  // Every one of these is something Tiptap can produce with an extension we did not install.
  for (
    const node of [
      { type: "image", attrs: { src: "https://example.test/x.png" } },
      { type: "codeBlock", content: [{ type: "text", text: "rm -rf" }] },
      { type: "horizontalRule" },
      { type: "table" },
    ]
  ) {
    assertFalse(
      accepts({ type: "doc", content: [node] }),
      `${node.type} should be refused`,
    );
  }
});

Deno.test("a mark outside the whitelist is refused", () => {
  for (
    const mark of [{ type: "underline" }, { type: "strike" }, { type: "code" }]
  ) {
    assertFalse(
      accepts({
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: "x", marks: [mark] }],
        }],
      }),
      `${mark.type} should be refused`,
    );
  }
});

Deno.test("only http, https and mailto links are stored", () => {
  const link = (href: string) => ({
    type: "doc",
    content: [{
      type: "paragraph",
      content: [{
        type: "text",
        text: "klick",
        marks: [{ type: "link", attrs: { href } }],
      }],
    }],
  });

  assert(accepts(link("https://example.test")));
  assert(accepts(link("http://example.test")));
  assert(accepts(link("mailto:someone@example.test")));

  // The whole reason links needed care.
  assertFalse(accepts(link("javascript:alert(1)")));
  assertFalse(accepts(link("data:text/html;base64,PHNjcmlwdD4=")));
  assertFalse(accepts(link("vbscript:msgbox")));
  assertFalse(accepts(link("/relative")));
});

Deno.test("attributes nobody asked for are dropped rather than stored", () => {
  const parsed = DOCUMENT_SCHEMA.parse({
    type: "doc",
    content: [{
      type: "paragraph",
      content: [{
        type: "text",
        text: "klick",
        marks: [{
          type: "link",
          attrs: {
            href: "https://example.test",
            target: "_blank",
            onclick: "steal()",
            class: "x",
          },
        }],
      }],
    }],
  });

  const marks = (parsed.content?.[0] as {
    content: Array<{ marks: Array<{ attrs: unknown }> }>;
  })
    .content[0].marks;
  assertEquals(marks[0].attrs, { href: "https://example.test" });
});

Deno.test("a heading may only be level 2 or 3", () => {
  const heading = (level: number) => ({
    type: "doc",
    content: [{
      type: "heading",
      attrs: { level },
      content: [{ type: "text", text: "x" }],
    }],
  });

  assert(accepts(heading(2)));
  assert(accepts(heading(3)));
  // A post sits under a thread title already; h1 would outrank it.
  assertFalse(accepts(heading(1)));
  assertFalse(accepts(heading(4)));
});

Deno.test("a document nested past the limit is refused", () => {
  let node: unknown = paragraph("tief");
  for (let depth = 0; depth < 12; depth++) {
    node = { type: "blockquote", content: [node] };
  }

  assertFalse(accepts({ type: "doc", content: [node] }));
});

Deno.test("the derived text is the prose and nothing else", () => {
  const text = documentToText({
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Kapitel eins" }],
      },
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Der Markt ", marks: [{ type: "bold" }] },
          { type: "text", text: "öffnet." },
        ],
      },
      { type: "paragraph" },
      {
        type: "bulletList",
        content: [{ type: "listItem", content: [paragraph("Laternen")] }],
      },
    ],
  });

  // No node names, no attributes — a search for "stark" must not match a bold mark.
  assertEquals(text, "Kapitel eins\n\nDer Markt öffnet.\n\nLaternen");
});

Deno.test("list items are separate lines, not one run-on word", () => {
  const text = documentToText({
    type: "doc",
    content: [{
      type: "bulletList",
      content: [
        { type: "listItem", content: [paragraph("Laternen")] },
        { type: "listItem", content: [paragraph("Steckbriefe")] },
      ],
    }],
  });

  assertEquals(text, "Laternen\nSteckbriefe");
});

Deno.test("a hard break reads as a line break", () => {
  assertEquals(
    documentToText({
      type: "doc",
      content: [{
        type: "paragraph",
        content: [
          { type: "text", text: "erste" },
          { type: "hardBreak" },
          { type: "text", text: "zweite" },
        ],
      }],
    }),
    "erste\nzweite",
  );
});

Deno.test("an empty document derives to nothing", () => {
  assertEquals(documentToText({ type: "doc" }), "");
  assertEquals(
    documentToText({ type: "doc", content: [{ type: "paragraph" }] }),
    "",
  );
});
