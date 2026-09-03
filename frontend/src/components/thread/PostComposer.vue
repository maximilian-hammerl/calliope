<script setup lang="ts">
import { ChevronDown, ChevronUp } from '@lucide/vue'
import { nextTick, ref, useTemplateRef } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import type { PostDocument } from '@/api/models'
import type { DraftStatus } from '@/composables/useDraft'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import PostEditor from '@/components/thread/PostEditor.vue'

defineProps<{ sending: boolean; draftStatus: DraftStatus }>()
const document = defineModel<PostDocument>({ required: true })
/** The prose of the document, from the editor rather than a second walker. */
const text = defineModel<string>('text', { required: true })
const emit = defineEmits<{ submit: [] }>()

/**
 * Collapsing the composer is half of the reading mode; there is no separate mode. On a phone it
 * starts collapsed, where expanded it took a third of the screen before a word was read. Read
 * once rather than watched, so resizing never opens or closes an editor somebody is using.
 */
const collapsed = ref<boolean>(useMediaQuery('(max-width: 767px)').value)

const editor = useTemplateRef<{ focus: () => void }>('editor')

/** Focus follows the expansion, so opening the bar and typing is one gesture, not two. */
async function expand() {
  collapsed.value = false
  await nextTick()
  editor.value?.focus()
}
</script>

<template>
  <button
    v-if="collapsed"
    type="button"
    class="min-h-11 flex-none border-t border-line-3 bg-paper-0 px-gutter py-[13px] text-left md:px-10"
    @click="expand"
  >
    <div class="reading-column flex items-center gap-3 text-[12.5px] text-ink-5">
      <span class="font-semibold text-ink-4">Weiterschreiben</span>
      <span
        class="ml-auto flex items-center gap-1 rounded-lg border border-line-4 px-[9px] py-1 text-oak-deep"
      >
        Editor ausklappen
        <ChevronUp :size="14" :stroke-width="1.5" />
      </span>
    </div>
  </button>

  <div v-else class="flex-none border-t border-line-3 bg-paper-0 px-gutter pt-[13px] pb-4 md:px-10">
    <div class="reading-column">
      <div class="mb-2.5 flex items-center gap-3.5 text-[12.5px] text-ink-5">
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
          class="ml-auto flex min-h-11 items-center gap-1 rounded-lg border border-line-4 px-[9px] text-oak-deep md:min-h-0 md:py-1"
          aria-label="Editor einklappen"
          @click="collapsed = true"
        >
          <span class="hidden sm:inline">Editor einklappen</span>
          <ChevronDown :size="14" :stroke-width="1.5" />
        </button>
      </div>

      <PostEditor
        ref="editor"
        v-model:document="document"
        v-model:text="text"
        :disabled="sending"
        capped
      />

      <div class="mt-[11px] flex items-center">
        <div class="ml-auto flex items-center gap-2.5">
          <!-- Locked while sending: a flaky connection must not produce a double post, but two
               deliberate posts in a row stay possible. -->
          <Button size="lg" :disabled="sending || text.trim().length === 0" @click="emit('submit')">
            <Spinner v-if="sending" />
            {{ sending ? 'Wird gesendet …' : 'Beitrag senden' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
