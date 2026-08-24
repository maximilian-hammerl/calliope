<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { formatActivityTime } from '@/lib/format/formatTime'
import type { ListPosts200ResultsItem, PostDocument } from '@/api/models'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { emptyDocument } from '@/lib/document/emptyDocument'
import { sameDocument } from '@/lib/document/sameDocument'
import PostBody from '@/components/thread/PostBody.vue'
import PostEditor from '@/components/thread/PostEditor.vue'

const props = defineProps<{
  post: ListPosts200ResultsItem
  divider: boolean
  first: boolean
  /** Absent while the reader is unknown; reporting your own post is not a thing. */
  currentUserId?: string
  mayAdminister?: boolean
  /** The thread decides which post is open, so two cannot be edited at once. */
  editing?: boolean
  saving?: boolean
  error?: string
}>()

const emit = defineEmits<{
  report: []
  edit: []
  cancel: []
  save: [document: PostDocument, text: string]
  delete: []
}>()

// Only your own post is excluded. A post whose author is gone is still reportable: the writing
// is still there, and removing it is still something an operator can do.
const mayReport = computed<boolean>(
  () => props.currentUserId !== undefined && props.post.createdBy !== props.currentUserId,
)

/** The API's own rule, so the row never offers what the endpoint would refuse. */
const mayModify = computed<boolean>(
  () =>
    props.mayAdminister ||
    (props.post.createdBy !== null && props.post.createdBy === props.currentUserId),
)

/**
 * Edited where it sits rather than in the composer: that one is bound to the member's draft,
 * which the database allows exactly one of per thread, so borrowing it would put a half-written
 * post at risk to fix a typo.
 */
const draft = ref<PostDocument>(emptyDocument())
const draftText = ref<string>('')

const postEditor = useTemplateRef<{ focus: () => void }>('postEditor')

watch(
  () => props.editing,
  async (open) => {
    if (!open) return
    // The stored document, not a rebuild from `post.text`: that projection has no marks in it,
    // so editing a post with a heading or a bold word would silently flatten it.
    draft.value = props.post.document
    draftText.value = props.post.text
    await nextTick()
    // Focus follows the opening, as it does for the composer: open and type is one gesture.
    postEditor.value?.focus()
  },
  { immediate: true },
)

/** Compared as documents: re-bolding a word changes no prose, and Speichern must still light up. */
const unchanged = computed<boolean>(() => sameDocument(draft.value, props.post.document))

/**
 * Named only when somebody other than the author edited it — an administrator may, and that is
 * the one case worth saying out loud. "bearbeitet von federkiel" beside "federkiel" is noise.
 */
const editedNote = computed<string | undefined>(() => {
  if (props.post.editedAt === null) return undefined

  const editor = props.post.editedByUsername
  const byAnother = editor !== null && editor !== props.post.createdByUsername
  return byAnother ? `bearbeitet von ${editor}` : 'bearbeitet'
})

// Metadata is deliberately recessed: post headers were competing with the writing.
const meta = computed<string>(() => {
  const author = props.post.createdByUsername ?? 'Gelöschtes Konto'
  return [author, formatActivityTime(props.post.createdAt), editedNote.value]
    .filter((part) => part !== undefined)
    .join(' · ')
})
</script>

<template>
  <article
    class="py-[26px]"
    :class="[divider ? 'border-b border-line-2' : '', first ? 'pt-0' : '']"
  >
    <div class="mb-[9px] flex items-center gap-3">
      <span class="text-[12px] leading-[1.3] text-ink-6">{{ meta }}</span>
    </div>

    <div v-if="editing" class="flex flex-col gap-2.5">
      <PostEditor
        ref="postEditor"
        v-model:document="draft"
        v-model:text="draftText"
        :disabled="saving"
        framed
      />

      <Alert v-if="error" variant="destructive" role="alert">
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>
    </div>

    <PostBody v-else :document="post.document" />

    <!-- The row the placeholder actions used to occupy, in the same place and at the same
         weight (47cce00): below the writing, recessed to the metadata's size and colour, so it
         does not compete with the prose. Restored now that something in it works. -->
    <div
      v-if="mayModify || mayReport"
      class="mt-3.5 flex items-center gap-4 text-[12px] text-ink-5"
    >
      <template v-if="editing">
        <button
          type="button"
          class="flex min-h-11 items-center font-medium text-oak-deep disabled:opacity-50 md:min-h-0"
          :disabled="saving || unchanged"
          @click="emit('save', draft, draftText)"
        >
          {{ saving ? 'Wird gespeichert …' : 'Speichern' }}
        </button>
        <button
          type="button"
          class="flex min-h-11 items-center hover:text-oak-deep md:min-h-0"
          :disabled="saving"
          @click="emit('cancel')"
        >
          Abbrechen
        </button>
      </template>

      <template v-else>
        <button
          v-if="mayModify"
          type="button"
          class="flex min-h-11 items-center hover:text-oak-deep md:min-h-0"
          @click="emit('edit')"
        >
          Bearbeiten
        </button>
        <button
          v-if="mayModify"
          type="button"
          class="flex min-h-11 items-center hover:text-oak-deep md:min-h-0"
          @click="emit('delete')"
        >
          Löschen
        </button>
        <button
          v-if="mayReport"
          type="button"
          class="flex min-h-11 items-center hover:text-oak-deep md:min-h-0"
          @click="emit('report')"
        >
          Melden
        </button>
      </template>
    </div>
  </article>
</template>
