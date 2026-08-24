<script setup lang="ts">
/**
 * A post's document, rendered.
 *
 * `generateHTML` over the same extensions the editor uses, so the reader and the writer cannot
 * disagree about what a heading or a quote looks like — the classes live on the extensions, in
 * `lib/document/extensions.ts`, and serve both.
 *
 * **This is the one `v-html` in the application, and it rests on two things.** ProseMirror's
 * serialiser escapes text, so prose that looks like markup stays prose — verified in
 * `__tests__/postBody.spec.ts`. And every attribute that reaches the DOM is bounded by
 * `DOCUMENT_SCHEMA` on the way in: a link is `http`/`https` only, an image source is a relative
 * path, a class is a safe token. **Loosening that schema loosens this**, which is why the two are
 * named together here.
 *
 * Nothing guards `generateHTML` against throwing, and two tests are what make that safe rather
 * than optimistic. `__tests__/postBody.spec.ts` renders the whole conformance fixture here, so
 * every type in it is one these extensions can render; and the backend's
 * `document_schema_test.ts` asserts the schema accepts nothing the fixture does not carry. Between
 * them the schema cannot allow a document this cannot render, so a throw would mean a drift that
 * already failed a test — worth seeing rather than degrading for.
 */
import { computed } from 'vue'
import { generateHTML } from '@tiptap/core'
import type { PostDocument } from '@/api/models'
import { DOCUMENT_EXTENSIONS } from '@/lib/document/extensions'

const props = defineProps<{ document: PostDocument }>()

const html = computed<string>(() => generateHTML(props.document, DOCUMENT_EXTENSIONS))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- see the note above; the source is validated JSON -->
  <div class="flex flex-col gap-[0.9em] [&_a]:underline" v-html="html" />
</template>
