<script setup lang="ts">
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { postExtensions } from '@/lib/postEditor'
import { isEmptyDocument } from '@/lib/postDocument'
import type { DraftStatus } from '@/lib/useDraft'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

defineProps<{ sending: boolean; draftStatus: DraftStatus }>()
const document = defineModel<unknown>({ required: true })
const emit = defineEmits<{ submit: [] }>()

// Collapsing the composer is half of the reading mode; there is no separate mode.
const collapsed = ref<boolean>(false)

const editor = useEditor({
  content: (document.value ?? undefined) as never,
  extensions: postExtensions('Schreib weiter …'),
  editorProps: {
    attributes: {
      'aria-label': 'Beitrag schreiben',
      class:
        'min-h-[76px] w-full font-serif text-[16.5px] leading-[1.75] text-ink-3 caret-oak outline-none',
    },
  },
  onUpdate: ({ editor }) => {
    document.value = editor.getJSON()
  },
})

/**
 * Only when the two have genuinely diverged — a draft arriving from the server, or the model
 * being cleared after publishing. Writing back on every keystroke would reset the cursor to
 * the start of what is being typed.
 */
watch(document, (next) => {
  if (editor.value === undefined) return
  if (JSON.stringify(next) === JSON.stringify(editor.value.getJSON())) return
  editor.value.commands.setContent((next ?? '') as never, { emitUpdate: false })
})

onBeforeUnmount(() => editor.value?.destroy())

/** German quotation marks, which the design system requires and no keyboard offers. */
function insertQuotationMarks() {
  const current = editor.value
  if (current === undefined) return

  const { from, to, empty } = current.state.selection
  if (empty) {
    current.chain().focus().insertContent('„“').run()
    // Between the marks, ready to type into.
    current.commands.setTextSelection(current.state.selection.from - 1)
    return
  }

  const selected = current.state.doc.textBetween(from, to)
  current.chain().focus().insertContentAt({ from, to }, `„${selected}“`).run()
}

/** Label, what it does, and how to tell whether it is already on. */
const TOOLS = [
  {
    label: 'B',
    title: 'Fett',
    mark: 'bold',
    run: () => editor.value?.chain().focus().toggleBold().run(),
  },
  {
    label: 'I',
    title: 'Kursiv',
    mark: 'italic',
    run: () => editor.value?.chain().focus().toggleItalic().run(),
  },
  { label: '„“', title: 'Anführungszeichen', mark: undefined, run: insertQuotationMarks },
  {
    label: 'Überschrift',
    title: 'Überschrift',
    mark: 'heading',
    run: () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'Liste',
    title: 'Liste',
    mark: 'bulletList',
    run: () => editor.value?.chain().focus().toggleBulletList().run(),
  },
  {
    label: 'Zitat',
    title: 'Zitat',
    mark: 'blockquote',
    run: () => editor.value?.chain().focus().toggleBlockquote().run(),
  },
] as const
</script>

<template>
  <div
    v-if="collapsed"
    class="flex-none cursor-pointer border-t border-line-3 bg-paper-0 px-[18px] py-[13px] md:px-10"
    @click="collapsed = false"
  >
    <div class="flex max-w-[684px] items-center gap-3 text-[12.5px] text-ink-5">
      <span class="font-semibold text-ink-4">Weiterschreiben</span>
      <span
        class="ml-auto flex items-center gap-[4px] rounded-lg border border-line-4 px-[9px] py-[4px] text-oak-deep"
      >
        Editor ausklappen
        <ChevronUp :size="14" :stroke-width="1.5" />
      </span>
    </div>
  </div>

  <div v-else class="flex-none border-t border-line-3 bg-paper-0 px-[18px] pt-[13px] pb-4 md:px-10">
    <div class="max-w-[684px]">
      <div class="mb-[10px] flex items-center gap-[14px] text-[12.5px] text-ink-5">
        <span class="font-semibold text-ink-4">Weiterschreiben</span>

        <!-- Continuous and without a timestamp: the point is that saving is happening, not
             when it last did. The failure is stated plainly and nothing is cleared. -->
        <span
          v-if="draftStatus !== 'idle'"
          class="flex items-center gap-[5px]"
          :class="draftStatus === 'failed' ? 'text-destructive' : ''"
          role="status"
        >
          <Spinner v-if="draftStatus === 'saving'" class="size-3" />
          {{
            draftStatus === 'saving'
              ? 'Entwurf wird gespeichert'
              : draftStatus === 'failed'
                ? 'Entwurf nicht gespeichert'
                : 'Entwurf gespeichert'
          }}
        </span>

        <button
          type="button"
          class="ml-auto flex items-center gap-[4px] rounded-lg border border-line-4 px-[9px] py-[4px] text-oak-deep"
          @click="collapsed = true"
        >
          Editor einklappen
          <ChevronDown :size="14" :stroke-width="1.5" />
        </button>
      </div>

      <EditorContent :editor="editor" class="post-editor" />

      <div
        class="mt-[6px] flex items-center justify-between gap-[14px] border-t border-line-1 pt-[11px]"
      >
        <!-- Only what works. Bild and Datei are gone until there is somewhere to put a file;
             a link needs no button, because typing or pasting an address makes one. -->
        <div class="flex gap-[15px] text-[12.5px] text-ink-5">
          <button
            v-for="(tool, index) in TOOLS"
            :key="tool.label"
            type="button"
            :title="tool.title"
            :aria-pressed="tool.mark ? editor?.isActive(tool.mark) : undefined"
            class="leading-none"
            :class="[
              index === 0 ? 'font-semibold' : '',
              index === 1 ? 'italic' : '',
              tool.mark && editor?.isActive(tool.mark) ? 'text-ink-1' : 'hover:text-ink-2',
            ]"
            @click="tool.run"
          >
            {{ tool.label }}
          </button>
        </div>
        <div class="ml-auto flex items-center gap-[10px]">
          <Button variant="outline" size="sm" disabled title="Noch nicht verfügbar"
            >Vorschau</Button
          >
          <!-- Locked while sending: a flaky connection must not produce a double post, but two
               deliberate posts in a row stay possible. -->
          <Button
            size="lg"
            :disabled="sending || isEmptyDocument(document)"
            @click="emit('submit')"
          >
            <Spinner v-if="sending" data-icon="inline-start" />
            {{ sending ? 'Wird gesendet …' : 'Beitrag senden' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
