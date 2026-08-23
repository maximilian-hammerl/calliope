<script setup lang="ts">
import { computed } from 'vue'
import { formatActivityTime } from '@/lib/format/formatTime'
import { paragraphs } from '@/lib/format/formatText'
import type { ListPosts200ResultsItem } from '@/api/models'

const props = defineProps<{
  post: ListPosts200ResultsItem
  divider: boolean
  first: boolean
  /** Absent while the reader is unknown; reporting your own post is not a thing. */
  currentUserId?: string
}>()

defineEmits<{ report: [] }>()

// Only your own post is excluded. A post whose author is gone is still reportable: the writing
// is still there, and removing it is still something an operator can do.
const mayReport = computed<boolean>(
  () => props.currentUserId !== undefined && props.post.createdBy !== props.currentUserId,
)

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

    <!-- The row the placeholder actions used to occupy, in the same place and at the same
         weight (47cce00): below the writing, recessed to the metadata's size and colour, so it
         does not compete with the prose. Restored now that something in it works. -->
    <div v-if="mayReport" class="mt-[14px] flex items-center gap-4 text-[12px] text-ink-5">
      <button
        type="button"
        class="flex min-h-11 items-center hover:text-oak-deep md:min-h-0"
        @click="$emit('report')"
      >
        Melden
      </button>
    </div>
  </article>
</template>
