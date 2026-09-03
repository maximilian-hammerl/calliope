<script setup lang="ts">
/**
 * The composer's editor. Tiptap over the vocabulary in `lib/document/extensions.ts`, which is the
 * same list the conformance fixture is built on, so what a member can type is what the API accepts.
 *
 * The toolbar is three menus and nothing else. Twenty-one controls do not fit one strip — see #81
 * — and a menu affords the whole German word, so the strip's abbreviations and the icon-only
 * alignment exception both went with the regrouping.
 */
import type { Component } from 'vue'
import { ref, useTemplateRef, watch } from 'vue'
import type { ChainedCommands, Editor } from '@tiptap/core'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { BubbleMenuPlugin } from '@tiptap/extension-bubble-menu'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListOrdered,
  Minus,
  Quote,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from '@lucide/vue'
import type { PostDocument } from '@/api/models'
import { DOCUMENT_EXTENSIONS } from '@/lib/document/extensions'
import { hasRemovableMarks, REMOVABLE_MARKS } from '@/lib/document/removableMarks'
import { sameDocument } from '@/lib/document/sameDocument'
import LinkDialog from '@/components/thread/LinkDialog.vue'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const props = defineProps<{
  document: PostDocument
  disabled?: boolean
  /**
   * Draw the editor as a field. The composer needs none — it already sits on its own raised bar,
   * and a box inside a box is what the design system spends hairlines to avoid — but a post edited
   * in place has nothing to distinguish it from the posts around it.
   */
  framed?: boolean

  /**
   * Stop growing at a ceiling and scroll inside it. Only the composer wants this: it is
   * `flex-none` in a full-height column, so every line it grows is a line of the thread — #84.
   * A post edited in place sits in the scrolling thread and may take the room it needs.
   */
  capped?: boolean
}>()

const emit = defineEmits<{
  'update:document': [PostDocument]
  /** The prose, for the length guard and the empty check — `getText()` rather than a second walker. */
  'update:text': [string]
}>()

/**
 * Bumped whenever the selection moves, and read by everything that marks itself from it. Tiptap 3's
 * `useEditor` assigns its ref once and never again, so a selection change alone re-renders nothing.
 */
const selectionRevision = ref<number>(0)

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
  // Tiptap 3's `useEditor` assigns its ref once and never again, so the only thing that re-renders
  // this component is a prop change — which a *selection* never causes. Everything that marks
  // itself from the selection (the toggles, the alignment, the bubble) needs this to change with it.
  onSelectionUpdate: () => {
    selectionRevision.value += 1
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
/** A control that is on or off. `active` is a predicate because `isActive` is overloaded. */
type Toggle = {
  title: string
  icon: Component
  active: (editor: Editor) => boolean
  apply: (chain: ChainedCommands) => ChainedCommands
  /**
   * Also offered in the selection bubble. Which of them are is a judgement about what people reach
   * for on a selection, not a category — `Durchgestrichen` is in and `Code` is out. Do not "tidy"
   * it into symmetry.
   */
  inBubble?: true
}

const CHARACTER: readonly Toggle[] = [
  {
    title: 'Fett',
    icon: Bold,
    inBubble: true,
    active: (e) => e.isActive('bold'),
    apply: (c) => c.toggleBold(),
  },
  {
    title: 'Kursiv',
    icon: Italic,
    inBubble: true,
    active: (e) => e.isActive('italic'),
    apply: (c) => c.toggleItalic(),
  },
  {
    title: 'Unterstrichen',
    icon: Underline,
    inBubble: true,
    active: (e) => e.isActive('underline'),
    apply: (c) => c.toggleUnderline(),
  },
  {
    title: 'Durchgestrichen',
    icon: Strikethrough,
    inBubble: true,
    active: (e) => e.isActive('strike'),
    apply: (c) => c.toggleStrike(),
  },
  { title: 'Code', icon: Code, active: (e) => e.isActive('code'), apply: (c) => c.toggleCode() },
]

const BUBBLE = CHARACTER.filter((toggle) => toggle.inBubble === true)

const PARAGRAPH: readonly Toggle[] = [
  {
    title: 'Überschrift',
    icon: Heading2,
    active: (e) => e.isActive('heading', { level: 2 }),
    apply: (c) => c.toggleHeading({ level: 2 }),
  },
  {
    title: 'Zwischenüberschrift',
    icon: Heading3,
    active: (e) => e.isActive('heading', { level: 3 }),
    apply: (c) => c.toggleHeading({ level: 3 }),
  },
  {
    title: 'Liste',
    icon: List,
    active: (e) => e.isActive('bulletList'),
    apply: (c) => c.toggleBulletList(),
  },
  {
    title: 'Nummerierte Liste',
    icon: ListOrdered,
    active: (e) => e.isActive('orderedList'),
    apply: (c) => c.toggleOrderedList(),
  },
  {
    title: 'Zitat',
    icon: Quote,
    active: (e) => e.isActive('blockquote'),
    apply: (c) => c.toggleBlockquote(),
  },
]

/** One of four rather than four toggles, which is what a radio group is for. */
const ALIGNMENTS = [
  { title: 'Linksbündig', value: 'left', icon: AlignLeft },
  { title: 'Zentriert', value: 'center', icon: AlignCenter },
  { title: 'Rechtsbündig', value: 'right', icon: AlignRight },
  { title: 'Blocksatz', value: 'justify', icon: AlignJustify },
] as const

function isActive(toggle: Toggle): boolean {
  void selectionRevision.value
  const instance = editor.value
  return instance !== undefined && toggle.active(instance)
}

function currentAlignment(): string | undefined {
  void selectionRevision.value
  const instance = editor.value
  if (instance === undefined) return undefined
  return ALIGNMENTS.find((alignment) => instance.isActive({ textAlign: alignment.value }))?.value
}

function setAlignment(value: unknown) {
  if (typeof value === 'string') editor.value?.chain().focus().setTextAlign(value).run()
}

function insertRule() {
  editor.value?.chain().focus().setHorizontalRule().run()
}

/**
 * The bubble's element has to exist before the plugin can be given it, and `useEditor` builds the
 * editor in `onMounted` — so this waits for the editor rather than for a hook order.
 */
const bubble = useTemplateRef<HTMLElement>('bubble')

// Tiptap's editor ref re-triggers on every transaction, so the watcher fires far more than once.
let bubbleRegistered = false

watch(
  editor,
  (instance) => {
    const element = bubble.value
    if (bubbleRegistered || instance === undefined || element === null) return
    bubbleRegistered = true
    instance.registerPlugin(
      BubbleMenuPlugin({
        editor: instance,
        element,
        pluginKey: 'postEditorBubble',
        options: {
          // Below the selection, not the library's default of above: a phone puts its own
          // selection menu above the text, and the two would cover each other.
          placement: 'bottom',
          // Never closer to the edge than the phone gutter, or it reads as a mistake.
          shift: { padding: 18 },
        },
      }),
    )
  },
  // `post`, or this runs before the render that assigns the template ref and the element is null —
  // which leaves the bubble sitting open under the editor with nothing selected.
  { flush: 'post' },
)

function hasStyling(): boolean {
  void selectionRevision.value
  const instance = editor.value
  return instance !== undefined && hasRemovableMarks(instance.state)
}

function removeStyling() {
  const instance = editor.value
  if (instance === undefined) return

  let chain = instance.chain().focus()
  for (const mark of REMOVABLE_MARKS) {
    chain = chain.unsetMark(mark, { extendEmptyMarkRange: true })
  }
  chain.run()
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

function apply(toggle: Toggle) {
  const instance = editor.value
  if (instance === undefined) return
  toggle.apply(instance.chain().focus()).run()
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
    <!-- The toolbar stays outside, so formatting is reachable while the prose scrolls. -->
    <EditorContent
      :editor="editor"
      :class="capped ? 'max-h-[clamp(184px,22svh,320px)] overflow-y-auto' : undefined"
    />

    <!-- Scrolls rather than wrapping or hiding: formatting has to be reachable on a phone, and a
         second row would push the writing off a short screen. -->
    <div
      v-if="editor"
      class="mt-1.5 -mx-1 flex items-center gap-0.5 border-t border-line-1 px-1 pt-[11px]"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          class="flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-transparent px-2 text-[12.5px] text-ink-5 hover:text-ink-2 data-[state=open]:border-line-4 data-[state=open]:bg-paper-0 data-[state=open]:text-ink-1 md:min-h-8"
        >
          Absatz
          <ChevronDown :size="14" :stroke-width="1.5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuCheckboxItem
            v-for="toggle in PARAGRAPH"
            :key="toggle.title"
            :model-value="isActive(toggle)"
            @update:model-value="apply(toggle)"
          >
            <component :is="toggle.icon" :size="16" :stroke-width="1.5" aria-hidden="true" />
            {{ toggle.title }}
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />

          <DropdownMenuRadioGroup
            :model-value="currentAlignment()"
            @update:model-value="setAlignment"
          >
            <DropdownMenuRadioItem
              v-for="alignment in ALIGNMENTS"
              :key="alignment.value"
              :value="alignment.value"
            >
              <component :is="alignment.icon" :size="16" :stroke-width="1.5" aria-hidden="true" />
              {{ alignment.title }}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          class="flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-transparent px-2 text-[12.5px] text-ink-5 hover:text-ink-2 data-[state=open]:border-line-4 data-[state=open]:bg-paper-0 data-[state=open]:text-ink-1 md:min-h-8"
        >
          Zeichen
          <ChevronDown :size="14" :stroke-width="1.5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuCheckboxItem
            v-for="toggle in CHARACTER"
            :key="toggle.title"
            :model-value="isActive(toggle)"
            @update:model-value="apply(toggle)"
          >
            <component :is="toggle.icon" :size="16" :stroke-width="1.5" aria-hidden="true" />
            {{ toggle.title }}
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />

          <!-- #81 adds the five pickers above this line. -->
          <DropdownMenuItem :disabled="!hasStyling()" @select="removeStyling()">
            <component :is="RemoveFormatting" :size="16" :stroke-width="1.5" aria-hidden="true" />
            Formatierung entfernen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger
          class="flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-transparent px-2 text-[12.5px] text-ink-5 hover:text-ink-2 data-[state=open]:border-line-4 data-[state=open]:bg-paper-0 data-[state=open]:text-ink-1 md:min-h-8"
        >
          Einfügen
          <ChevronDown :size="14" :stroke-width="1.5" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuItem @select="openLinkDialog()">
            <component :is="Link" :size="16" :stroke-width="1.5" aria-hidden="true" />
            Link
          </DropdownMenuItem>
          <DropdownMenuItem @select="insertRule()">
            <component :is="Minus" :size="16" :stroke-width="1.5" aria-hidden="true" />
            Trennlinie
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <!--
      Shown by the plugin only while text is selected, which is why it is the fast path and not the
      complete one: a mark can also be set on a collapsed cursor, and that case has no bubble, so
      `Zeichen` above has to hold everything this does. A hairline on paper rather than a floating
      card — nothing at rest casts a shadow, and this is at rest whenever it is visible.
    -->
    <div
      ref="bubble"
      class="invisible absolute flex items-center gap-0.5 rounded-lg border border-line-4 bg-paper-0 px-1 py-1"
    >
      <button
        v-for="toggle in BUBBLE"
        :key="toggle.title"
        type="button"
        :title="toggle.title"
        :aria-label="toggle.title"
        :aria-pressed="isActive(toggle)"
        class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded border px-2 text-[12.5px] md:min-h-8 md:min-w-9"
        :class="
          isActive(toggle)
            ? 'border-line-4 bg-paper-2 text-ink-1'
            : 'border-transparent text-ink-5 hover:text-ink-2'
        "
        @click="apply(toggle)"
      >
        <component :is="toggle.icon" :size="16" :stroke-width="1.5" aria-hidden="true" />
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
