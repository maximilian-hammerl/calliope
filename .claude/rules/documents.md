---
paths:
  - "backend/src/document/**"
  - "backend/src/service/writing_post_service.ts"
  - "backend/src/route/**/posts/**"
  - "frontend/src/lib/document/**"
  - "frontend/src/components/thread/Post*.vue"
  - "frontend/src/composables/useDraft.ts"
---

# A post is a document (#44)

A post's body is a **Tiptap JSON document in `jsonb`**, and HTML is only ever a render target. The
format is `backend/src/document/document_schema.ts`, a **closed Zod allowlist**: every node type,
mark type and attribute was read off `editor.getJSON()` (the fixture in `document_schema_test.ts` is
what fails on a Tiptap upgrade), and the Tiptap version is pinned exactly because the stored shape is
the library's — an extension renaming an attribute is a data migration.

- **Unknown nodes, marks and attributes are rejected, not stripped.** Every object is
  `z.strictObject`; a plain `z.object` *strips* silently, turning a refusal into acceptance.
  `grep -c 'z\.object(' document_schema.ts` must stay 0. Depth and node count are bounded.
- **Free values are the validation surface**: a link is `http`/`https`/`mailto` only, an image
  source a relative path, a class a safe token. **Loosening the schema loosens `PostBody`'s
  `v-html`**, the one `v-html` in the application — the two are named together in its docblock.
- **`writing_post.text` is derived server-side**, `documentToPlainText`, never accepted from the
  client: search, the report excerpt and the length limit all read it, and a client-supplied
  projection could disagree with the document. It is shaped like textarea input, blocks separated by
  blank lines, and recurses into containers — a nested list once vanished from search because it
  did not. `TEXT_LIMIT.postText` applies to that text, not to the serialisation.
- Tiptap emits `""` for an attribute it found unset, so `unset()` preprocesses every optional
  attribute to `undefined` — a paste that left one unset otherwise refused the whole post.

## On the frontend

`lib/document/extensions.ts` holds the extensions **both** the editor and `generateHTML` use, so
reader and writer cannot disagree about what a heading looks like. `PostEditor` is the Tiptap
instance; `PostBody` renders without one — a hundred-post thread must not mount a hundred editors.
`useDraft` autosaves the document on a debounce and compares with `sameDocument`; the composer
starts collapsed and can be resized by dragging its top edge (#84). Send the `getJSON()` object,
never a string — stringifying stores a `jsonb` *string*.
