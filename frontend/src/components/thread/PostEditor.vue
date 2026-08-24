<script setup lang="ts">
/**
 * The composer's editor. Tiptap over the vocabulary in `lib/document/extensions.ts`, which is the
 * same list the conformance fixture is built on, so what a member can type is what the API accepts.
 *
 * The toolbar keeps the text-label idiom the inert placeholder established (`B`, `I`, „“, Liste)
 * rather than a row of bare icons, because the design system asks that an icon accompany a label
 * rather than replace it. Alignment is the one exception and says why below.
 */
import type { Component } from 'vue'
import { ref, watch } from 'vue'
import type { ChainedCommands, Editor } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from '@lucide/vue'
import type { PostDocument } from '@/api/models'
import { DOCUMENT_EXTENSIONS } from '@/lib/document/extensions'
import { sameDocument } from '@/lib/document/sameDocument'
import LinkDialog from '@/components/thread/LinkDialog.vue'

const props = defineProps<{
  document: PostDocument
  disabled?: boolean
  /**
   * Draw the editor as a field. The composer needs none — it already sits on its own raised bar,
   * and a box inside a box is what the design system spends hairlines to avoid — but a post edited
   * in place has nothing to distinguish it from the posts around it.
   */
  framed?: boolean
}>()

const emit = defineEmits<{
  'update:document': [PostDocument]
  /** The prose, for the length guard and the empty check — `getText()` rather than a second walker. */
  'update:text': [string]
}>()

const editor = useEditor({
  content: props.document,
  extensions: DOCUMENT_EXTENSIONS,
  editable: !props.disabled,
  editorProps: {
    attributes: {
      // Prose stays 17px and serif; the caret is the accent, as in the textarea it replaces.
      class:
        'prose-post min-h-[76px] w-full text-ink-3 caret-oak outline-none [&_p.is-editor-empty:first-child::before]:pointer-events-none [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-ink-6 [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
      'aria-label': 'Beitrag schreiben',
      // Tiptap sets `role="textbox"` when it creates the view, and then loses it: mounting
      // through `EditorContent` calls `setOptions({ element })`, which hands ProseMirror
      // `editorProps` as stored — without the role it injected — and `setProps` replaces rather
      // than merges. Declared here so it survives, with the `aria-multiline` the role needs.
      role: 'textbox',
      'aria-multiline': 'true',
    },
  },
  onUpdate: ({ editor: instance }) => {
    emit('update:document', instance.getJSON() as PostDocument)
    emit('update:text', instance.getText())
  },
})

/**
 * A draft arriving from the server has to reach the editor, but writing back what the editor just
 * emitted would reset the selection on every keystroke — so this compares first, and does not
 * re-emit.
 */
watch(
  () => props.document,
  (next) => {
    const instance = editor.value
    if (instance === undefined) return
    if (sameDocument(instance.getJSON() as PostDocument, next)) return
    instance.commands.setContent(next, { emitUpdate: false })
  },
)

watch(
  () => props.disabled,
  (disabled) => editor.value?.setEditable(!disabled),
)

defineExpose({ focus: () => editor.value?.commands.focus() })

/**
 * The toolbar, as data. A module constant rather than a computed or a function called from the
 * template: none of it depends on the editor, so rebuilding it per render only made fifteen
 * closures and a non-null assertion. The one reactive part is whether a control is on, and that
 * is `isActive` below — a function rather than a computed because it turns on the *selection*,
 * which moves on every cursor keystroke, so a computed would recompute exactly as often and
 * cache nothing.
 *
 * Alignment sits in the same list with an icon instead of a label; `separatorBefore` is what
 * puts the hairline in front of it.
 */
type Tool = {
  title: string
  /** A short label, styled to show what it does — or an icon where no label is short enough. */
  label?: string
  icon?: Component
  labelClass?: string
  /** Whether the control is on. A predicate, because `isActive` is overloaded and
   *  `Parameters<…>` would resolve to only one of its signatures. */
  active: (editor: Editor) => boolean
  apply: (chain: ChainedCommands) => ChainedCommands
  separatorBefore?: boolean
}

const TOOLS: readonly Tool[] = [
  {
    title: 'Fett',
    label: 'B',
    labelClass: 'font-semibold',
    active: (e) => e.isActive('bold'),
    apply: (c) => c.toggleBold(),
  },
  {
    title: 'Kursiv',
    label: 'I',
    labelClass: 'italic',
    active: (e) => e.isActive('italic'),
    apply: (c) => c.toggleItalic(),
  },
  {
    title: 'Unterstrichen',
    label: 'U',
    labelClass: 'underline',
    active: (e) => e.isActive('underline'),
    apply: (c) => c.toggleUnderline(),
  },
  {
    title: 'Durchgestrichen',
    label: 'S',
    labelClass: 'line-through',
    active: (e) => e.isActive('strike'),
    apply: (c) => c.toggleStrike(),
  },
  {
    title: 'Überschrift',
    label: 'H2',
    active: (e) => e.isActive('heading', { level: 2 }),
    apply: (c) => c.toggleHeading({ level: 2 }),
  },
  {
    title: 'Zwischenüberschrift',
    label: 'H3',
    active: (e) => e.isActive('heading', { level: 3 }),
    apply: (c) => c.toggleHeading({ level: 3 }),
  },
  {
    title: 'Liste',
    label: 'Liste',
    active: (e) => e.isActive('bulletList'),
    apply: (c) => c.toggleBulletList(),
  },
  {
    title: 'Nummerierte Liste',
    label: '1. Liste',
    active: (e) => e.isActive('orderedList'),
    apply: (c) => c.toggleOrderedList(),
  },
  {
    title: 'Zitat',
    label: '\u201e\u201c',
    active: (e) => e.isActive('blockquote'),
    apply: (c) => c.toggleBlockquote(),
  },
  {
    title: 'Code',
    label: 'Code',
    labelClass: 'font-mono',
    active: (e) => e.isActive('code'),
    apply: (c) => c.toggleCode(),
  },
  // The one place an icon carries no label: four alignments spelled out would be longer than the
  // toolbar the rest of the controls fit in. The accessible name is the German word.
  {
    title: 'Linksbündig',
    icon: AlignLeft,
    active: (e) => e.isActive({ textAlign: 'left' }),
    apply: (c) => c.setTextAlign('left'),
    separatorBefore: true,
  },
  {
    title: 'Zentriert',
    icon: AlignCenter,
    active: (e) => e.isActive({ textAlign: 'center' }),
    apply: (c) => c.setTextAlign('center'),
  },
  {
    title: 'Rechtsbündig',
    icon: AlignRight,
    active: (e) => e.isActive({ textAlign: 'right' }),
    apply: (c) => c.setTextAlign('right'),
  },
  {
    title: 'Blocksatz',
    icon: AlignJustify,
    active: (e) => e.isActive({ textAlign: 'justify' }),
    apply: (c) => c.setTextAlign('justify'),
  },
]

function isActive(tool: Tool): boolean {
  const instance = editor.value
  return instance !== undefined && tool.active(instance)
}

const linkDialogOpen = ref<boolean>(false)

/**
 * The address of the link under the cursor, read when the dialog opens rather than derived.
 *
 * A `computed` passed as a prop looked equivalent and was not: the dialog fills its field from a
 * watcher on `open`, so whether it saw the current href depended on the order two props updated in
 * one render. A snapshot is what the dialog actually wants — the link as it was when it was asked
 * for — and it cannot be stale.
 */
const linkHref = ref<string | undefined>(undefined)

function openLinkDialog() {
  const attributes = editor.value?.getAttributes('link') as { href?: unknown } | undefined
  linkHref.value = typeof attributes?.href === 'string' ? attributes.href : undefined
  linkDialogOpen.value = true
}

function setLink(href: string) {
  // `extendMarkRange` so editing a link with the cursor merely inside it replaces the whole thing
  // rather than splitting it in two.
  editor.value?.chain().focus().extendMarkRange('link').setLink({ href }).run()
}

function removeLink() {
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
}

function apply(tool: Tool) {
  const instance = editor.value
  if (instance === undefined) return
  tool.apply(instance.chain().focus()).run()
}
</script>

<template>
  <!--
    Framed: a raised surface and one hairline, which is how the design system draws an active
    control. Each negative margin cancels its padding *and* the 1px border — 11px against 10px,
    15px against 14px — which is why they are bracketed: the prose stays exactly where it was being
    read, because clicking Bearbeiten must not move the words.

    The frame therefore bleeds outward, and on a phone the gutter is only 18px, so it bleeds less
    there: 11px leaves a 7px margin to the screen edge where 15px would leave 3px and read as a
    mistake. Change a padding here and its margin changes with it, or the words start moving.
  -->
  <div
    :class="
      framed
        ? '-mx-[11px] -my-[11px] rounded-lg border border-line-4 bg-paper-0 px-2.5 py-2.5 md:-mx-[15px] md:px-3.5'
        : undefined
    "
  >
    <EditorContent :editor="editor" />

    <!-- Scrolls rather than wrapping or hiding: formatting has to be reachable on a phone, and a
         second row would push the writing off a short screen. -->
    <div
      v-if="editor"
      class="mt-1.5 -mx-1 flex items-center gap-0.5 overflow-x-auto border-t border-line-1 px-1 pt-[11px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <template v-for="tool in TOOLS" :key="tool.title">
        <span v-if="tool.separatorBefore" class="mx-1 h-4 w-px shrink-0 bg-line-3" />

        <button
          type="button"
          :title="tool.title"
          :aria-label="tool.title"
          :aria-pressed="isActive(tool)"
          class="flex min-h-11 shrink-0 items-center rounded-lg border px-2 text-[12.5px] md:min-h-8"
          :class="[
            tool.labelClass,
            isActive(tool)
              ? 'border-line-4 bg-paper-0 text-ink-1'
              : 'border-transparent text-ink-5 hover:text-ink-2',
          ]"
          @click="apply(tool)"
        >
          <component :is="tool.icon" v-if="tool.icon" :size="14" :stroke-width="1.5" />
          <template v-else>{{ tool.label }}</template>
        </button>
      </template>

      <!-- Not in `TOOLS`: it opens a dialog for the address, so it is not a chainable toggle. -->
      <button
        type="button"
        title="Link"
        aria-label="Link"
        :aria-pressed="editor.isActive('link')"
        class="flex min-h-11 shrink-0 items-center rounded-lg border px-2 text-[12.5px] md:min-h-8"
        :class="
          editor.isActive('link')
            ? 'border-line-4 bg-paper-0 text-ink-1'
            : 'border-transparent text-ink-5 hover:text-ink-2'
        "
        @click="openLinkDialog()"
      >
        Link
      </button>
    </div>

    <LinkDialog
      v-model:open="linkDialogOpen"
      :href="linkHref"
      @submit="setLink"
      @remove="removeLink"
    />
  </div>
</template>
