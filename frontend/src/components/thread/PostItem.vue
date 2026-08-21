<script setup lang="ts">
import { computed } from 'vue'
import { formatActivityTime } from '@/lib/format/formatTime'
import { paragraphs } from '@/lib/format/paragraphs'
import type { ListPosts200ResultsItem } from '@/api/models'

const props = defineProps<{ post: ListPosts200ResultsItem; divider: boolean; first: boolean }>()

// Metadata is deliberately recessed: post headers were competing with the writing.
const meta = computed<string>(() => {
  const author = props.post.createdByUsername ?? 'Gelöschtes Konto'
  const edited = props.post.editedAt !== null
  return [author, formatActivityTime(props.post.createdAt), edited ? 'bearbeitet' : undefined]
    .filter((part) => part !== undefined)
    .join(' · ')
})

const blocks = computed<string[]>(() => paragraphs(props.post.text))
</script>

<template>
  <article
    class="py-[26px]"
    :class="[divider ? 'border-b border-line-2' : '', first ? 'pt-0' : '']"
  >
    <div class="mb-[9px] flex items-center gap-3">
      <span class="text-[12px] leading-[1.3] text-ink-6">{{ meta }}</span>
    </div>

    <div class="flex flex-col gap-[0.9em]">
      <p v-for="(paragraph, index) in blocks" :key="index" class="prose-post">
        {{ paragraph }}
      </p>
    </div>

    <!-- Placeholders: replying, quoting, bookmarking and annotations have no backend yet. -->
    <div class="mt-[14px] flex items-center gap-4 text-[12px] text-ink-5">
      <button
        v-for="action in ['Antworten', 'Zitieren', 'Merken']"
        :key="action"
        type="button"
        disabled
        class="disabled:opacity-50"
        title="Noch nicht verfügbar"
      >
        {{ action }}
      </button>
    </div>
  </article>
</template>
