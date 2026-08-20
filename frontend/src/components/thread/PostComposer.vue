<script setup lang="ts">
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { nextTick, ref, useTemplateRef } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import type { DraftStatus } from '@/composables/useDraft'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

defineProps<{ sending: boolean; draftStatus: DraftStatus }>()
const text = defineModel<string>({ required: true })
const emit = defineEmits<{ submit: [] }>()

/**
 * Collapsing the composer is half of the reading mode; there is no separate mode. On a phone it
 * starts collapsed, where expanded it took a third of the screen before a word was read. Read
 * once rather than watched, so resizing never opens or closes an editor somebody is using.
 */
const collapsed = ref<boolean>(useMediaQuery('(max-width: 767px)').value)

const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')

/** Focus follows the expansion, so opening the bar and typing is one gesture, not two. */
async function expand() {
  collapsed.value = false
  await nextTick()
  textarea.value?.focus()
}

// A rich text editor comes later. The formatting row is inert until then.
const TOOLS = ['B', 'I', '„“', 'Liste', 'Bild', 'Datei'] as const
</script>

<template>
  <button
    v-if="collapsed"
    type="button"
    class="min-h-11 flex-none border-t border-line-3 bg-paper-0 px-[18px] py-[13px] text-left md:px-10"
    @click="expand"
  >
    <div class="reading-column flex items-center gap-3 text-[12.5px] text-ink-5">
      <span class="font-semibold text-ink-4">Weiterschreiben</span>
      <span
        class="ml-auto flex items-center gap-[4px] rounded-lg border border-line-4 px-[9px] py-[4px] text-oak-deep"
      >
        Editor ausklappen
        <ChevronUp :size="14" :stroke-width="1.5" />
      </span>
    </div>
  </button>

  <div v-else class="flex-none border-t border-line-3 bg-paper-0 px-[18px] pt-[13px] pb-4 md:px-10">
    <div class="reading-column">
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
          class="ml-auto flex min-h-11 items-center gap-[4px] rounded-lg border border-line-4 px-[9px] text-oak-deep md:min-h-0 md:py-[4px]"
          aria-label="Editor einklappen"
          @click="collapsed = true"
        >
          <span class="hidden sm:inline">Editor einklappen</span>
          <ChevronDown :size="14" :stroke-width="1.5" />
        </button>
      </div>

      <textarea
        ref="textarea"
        v-model="text"
        rows="3"
        aria-label="Beitrag schreiben"
        placeholder="Schreib weiter …"
        class="min-h-[76px] w-full resize-y border-none bg-transparent font-serif text-[16.5px] leading-[1.75] text-ink-3 caret-oak outline-none placeholder:text-ink-6"
      />

      <div
        class="mt-[6px] flex items-center justify-between gap-[14px] border-t border-line-1 pt-[11px]"
      >
        <div class="hidden gap-[15px] text-[12.5px] text-ink-5 sm:flex">
          <span
            v-for="(tool, index) in TOOLS"
            :key="tool"
            class="opacity-50"
            :class="[index === 0 ? 'font-semibold' : '', index === 1 ? 'italic' : '']"
            title="Noch nicht verfügbar"
          >
            {{ tool }}
          </span>
        </div>
        <div class="ml-auto flex items-center gap-[10px]">
          <Button variant="outline" size="sm" disabled title="Noch nicht verfügbar"
            >Vorschau</Button
          >
          <!-- Locked while sending: a flaky connection must not produce a double post, but two
               deliberate posts in a row stay possible. -->
          <Button size="lg" :disabled="sending || text.trim().length === 0" @click="emit('submit')">
            <Spinner v-if="sending" data-icon="inline-start" />
            {{ sending ? 'Wird gesendet …' : 'Beitrag senden' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
