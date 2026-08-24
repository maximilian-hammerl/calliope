import { assertEquals } from "@std/assert";
import type { DocumentNode } from "@/src/document/document_schema.ts";
import { DOCUMENT_SCHEMA } from "@/src/document/document_schema.ts";
import { documentToPlainText } from "@/src/document/document_text.ts";

/**
 * The document Tiptap emits for every node and mark, as the frontend's `tiptapVocabulary.spec.ts`
 * pins it. Held as a constant here rather than read from a shared file: a test that reads the
 * filesystem is a test with a second way to fail, and these two ask different questions — that one
 * asks what the editor produces, this one asks what the schema accepts. They may drift.
 */
const FIXTURE = {
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": {
        "textAlign": "center",
        "level": 2,
      },
      "content": [
        {
          "type": "text",
          "text": "Überschrift",
        },
      ],
    },
    {
      "type": "paragraph",
      "attrs": {
        "textAlign": null,
      },
      "content": [
        {
          "type": "text",
          "marks": [
            {
              "type": "bold",
            },
          ],
          "text": "fett",
        },
        {
          "type": "text",
          "text": " ",
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "italic",
            },
          ],
          "text": "kursiv",
        },
        {
          "type": "text",
          "text": " ",
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "underline",
            },
          ],
          "text": "unterstrichen",
        },
        {
          "type": "text",
          "text": " ",
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "strike",
            },
          ],
          "text": "durchgestrichen",
        },
        {
          "type": "text",
          "text": " ",
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "code",
            },
          ],
          "text": "code",
        },
        {
          "type": "text",
          "text": " ",
        },
        {
          "type": "text",
          "marks": [
            {
              "type": "link",
              "attrs": {
                "href": "https://example.org",
                "target": "_blank",
                "rel": "noopener noreferrer nofollow",
                "class": null,
                "title": null,
              },
            },
          ],
          "text": "Link",
        },
      ],
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "attrs": {
                "textAlign": null,
              },
              "content": [
                {
                  "type": "text",
                  "text": "Punkt",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      "type": "orderedList",
      "attrs": {
        "start": 3,
        "type": null,
      },
      "content": [
        {
          "type": "listItem",
          "content": [
            {
              "type": "paragraph",
              "attrs": {
                "textAlign": null,
              },
              "content": [
                {
                  "type": "text",
                  "text": "Nummer",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      "type": "blockquote",
      "content": [
        {
          "type": "paragraph",
          "attrs": {
            "textAlign": null,
          },
          "content": [
            {
              "type": "text",
              "text": "Zitat",
            },
          ],
        },
      ],
    },
    {
      "type": "codeBlock",
      "attrs": {
        "language": "ts",
      },
      "content": [
        {
          "type": "text",
          "text": "const x = 1",
        },
      ],
    },
    {
      "type": "horizontalRule",
    },
    {
      "type": "paragraph",
      "attrs": {
        "textAlign": null,
      },
      "content": [
        {
          "type": "text",
          "text": "Zeile",
        },
        {
          "type": "hardBreak",
        },
        {
          "type": "text",
          "text": "danach",
        },
      ],
    },
    {
      "type": "image",
      "attrs": {
        "src": "/api/files/karte.png",
        "alt": "Karte",
        "title": "Titel",
        "width": null,
        "height": null,
      },
    },
    {
      "type": "table",
      "content": [
        {
          "type": "tableRow",
          "content": [
            {
              "type": "tableHeader",
              "attrs": {
                "colspan": 1,
                "rowspan": 1,
                "colwidth": null,
                "align": null,
              },
              "content": [
                {
                  "type": "paragraph",
                  "attrs": {
                    "textAlign": null,
                  },
                  "content": [
                    {
                      "type": "text",
                      "text": "Kopf",
                    },
                  ],
                },
              ],
            },
            {
              "type": "tableCell",
              "attrs": {
                "colspan": 1,
                "rowspan": 1,
                "colwidth": null,
                "align": null,
              },
              "content": [
                {
                  "type": "paragraph",
                  "attrs": {
                    "textAlign": null,
                  },
                  "content": [
                    {
                      "type": "text",
                      "text": "Zelle",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      "type": "paragraph",
      "attrs": {
        "textAlign": null,
      },
      "content": [
        {
          "type": "text",
          "marks": [
            {
              "type": "textStyle",
              "attrs": {
                "color": "#aa3311",
                "backgroundColor": "#f0e8d8",
                "fontFamily": "Newsreader",
                "fontSize": "18px",
                "lineHeight": "1.6",
              },
            },
          ],
          "text": "gestaltet",
        },
      ],
    },
  ],
};

Deno.test("the schema accepts every node and mark the editor emits", () => {
  const result = DOCUMENT_SCHEMA.safeParse(FIXTURE);

  assertEquals(
    result.success
      ? []
      : result.error.issues.map((issue) =>
        `${issue.path.join(".")}: ${issue.message}`
      ),
    [],
  );
});

Deno.test("the projection of that fixture reads as prose", () => {
  const text = documentToPlainText(FIXTURE);

  // Blocks separated by blank lines, and no serialised nodes in it.
  assertEquals(text.includes("Überschrift"), true);
  assertEquals(text.includes("\n\n"), true);
  assertEquals(text.includes('"type"'), false);
});

Deno.test("the schema refuses what it does not know", () => {
  const cases: Array<[string, unknown]> = [
    ["an unknown node", { type: "doc", content: [{ type: "script" }] }],
    ["an unknown mark", {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: "a", marks: [{ type: "blink" }] }],
      }],
    }],
    ["an unknown attribute", {
      type: "doc",
      content: [{ type: "paragraph", attrs: { onclick: "x" } }],
    }],
    ["a mailto: link, which a forum post has no use for", {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{
          type: "text",
          text: "a",
          marks: [{
            type: "link",
            attrs: { href: "mailto:someone@example.org" },
          }],
        }],
      }],
    }],
    ["a link that is not a URL at all", {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{
          type: "text",
          text: "a",
          marks: [{ type: "link", attrs: { href: "example.org" } }],
        }],
      }],
    }],
    ["a javascript: link", {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{
          type: "text",
          text: "a",
          marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
        }],
      }],
    }],
    ["a colour that closes a declaration", {
      type: "doc",
      content: [{
        type: "paragraph",
        content: [{
          type: "text",
          text: "a",
          marks: [{
            type: "textStyle",
            attrs: { color: "red; content: url(x)" },
          }],
        }],
      }],
    }],
    ["an absolute image source", {
      type: "doc",
      content: [{
        type: "image",
        attrs: { src: "https://elsewhere.example/x.png" },
      }],
    }],
    ["an empty document", { type: "doc", content: [] }],
    ["an empty text node", {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }],
    }],
    ["a heading past level six", {
      type: "doc",
      content: [{ type: "heading", attrs: { level: 7, textAlign: null } }],
    }],
  ];

  // Asserted as a set rather than a step each: `safeParse` is synchronous, so stepping would
  // only add an `await` in a loop, and this names every case that wrongly passed at once.
  assertEquals(
    cases.filter(([, value]) => DOCUMENT_SCHEMA.safeParse(value).success).map(
      ([name]) => name,
    ),
    [],
  );
});

Deno.test("the schema refuses a tree too deep to walk", () => {
  // Twenty-one levels of nesting, one past the bound.
  let node: unknown = { type: "text", text: "deep" };
  for (let index = 0; index < 21; index += 1) {
    node = { type: "blockquote", content: [node] };
  }

  assertEquals(
    DOCUMENT_SCHEMA.safeParse({ type: "doc", content: [node] }).success,
    false,
  );
});

/**
 * The projection is what `ILIKE` search, the report excerpt and the length limit all read, so text
 * missing from it is text a member can hide from search and from moderation. A nested list used to
 * disappear from it entirely.
 *
 * Typed helpers rather than `as never` at each call: the cast was only needed because the helpers
 * returned loose object literals, and it would have hidden a real mismatch just as well.
 */
function paragraph(text: string): DocumentNode {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function cell(...blocks: DocumentNode[]): DocumentNode {
  return { type: "tableCell", content: blocks };
}

function doc(...content: DocumentNode[]): DocumentNode {
  return { type: "doc", content };
}

Deno.test("the projection keeps the text of a nested list", () => {
  assertEquals(
    documentToPlainText(doc({
      type: "bulletList",
      content: [{
        type: "listItem",
        content: [paragraph("Aussen"), {
          type: "bulletList",
          content: [{ type: "listItem", content: [paragraph("INNEN")] }],
        }],
      }],
    })),
    "Aussen\n\nINNEN",
  );
});

Deno.test("the projection keeps a quotation and what follows it", () => {
  assertEquals(
    documentToPlainText(
      doc(
        { type: "blockquote", content: [paragraph("Zitat")] },
        paragraph("Danach"),
      ),
    ),
    "Zitat\n\nDanach",
  );
});

Deno.test("the projection reads a table row as one line", () => {
  assertEquals(
    documentToPlainText(doc({
      type: "table",
      content: [{
        type: "tableRow",
        content: [cell(paragraph("A")), cell(paragraph("B"))],
      }],
    })),
    "A\tB",
  );
});

Deno.test("the projection keeps both blocks of a cell holding two", () => {
  assertEquals(
    documentToPlainText(doc({
      type: "table",
      content: [{
        type: "tableRow",
        content: [cell(paragraph("Eins"), paragraph("Zwei"))],
      }],
    })),
    "Eins Zwei",
  );
});
