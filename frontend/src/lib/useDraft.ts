import { computed, type ComputedRef, ref, type Ref, toValue, watch } from 'vue'
import { useEventListener, watchDebounced } from '@vueuse/core'
import { createPost, deletePost, listPosts, updatePost } from '@/api/posts/posts'
import { TEXT_LIMIT } from '@/api/textLimit'
import { documentText, isEmptyDocument } from '@/lib/postDocument'

export type DraftStatus = 'idle' | 'saving' | 'saved' | 'failed'

/**
 * Keeps the composer's text on the server as a draft post, so nothing written is lost to a
 * reload or a closed tab.
 *
 * The draft is a real `writing_post` with `is_draft` set, which is why it is created lazily:
 * opening a thread and typing nothing leaves no row behind. Writing one deliberately does not
 * move the thread's `last_activity_at` — the trigger skips drafts — so a member composing in
 * silence neither reorders anybody's group list nor announces that they are typing.
 */
export function useDraft(
  groupId: Ref<string> | (() => string),
  threadId: Ref<string> | (() => string),
  document: Ref<unknown>,
): {
  status: ComputedRef<DraftStatus>
  /** The draft's id once it exists on the server, so publishing can update it in place. */
  draftId: Ref<string | undefined>
  loaded: Ref<boolean>
  forget: () => void
} {
  const draftId = ref<string | undefined>(undefined)
  const loaded = ref<boolean>(false)
  const saving = ref<boolean>(false)
  const failed = ref<boolean>(false)
  const savedOnce = ref<boolean>(false)

  /** What the server holds, serialised, so an unchanged draft is never written again. */
  let stored = ''

  const status = computed<DraftStatus>(() => {
    if (failed.value) return 'failed'
    if (saving.value) return 'saving'
    return savedOnce.value ? 'saved' : 'idle'
  })

  async function load() {
    loaded.value = false
    draftId.value = undefined
    savedOnce.value = false
    failed.value = false
    stored = ''

    try {
      // At most one draft per member per thread, enforced by a partial unique index.
      const response = await listPosts(toValue(groupId), toValue(threadId), {
        isDraft: true,
        limit: 1,
      })
      const existing = response.status === 200 ? response.data.results[0] : undefined
      if (existing !== undefined) {
        draftId.value = existing.id
        stored = JSON.stringify(existing.document)
        document.value = existing.document
        savedOnce.value = true
      }
    } catch {
      // A draft that cannot be read is not a reason to block writing a new one.
    } finally {
      loaded.value = true
    }
  }

  async function save() {
    // Before the existing draft has arrived, saving would create a second one and lose it.
    if (!loaded.value) return

    const current = JSON.stringify(document.value)
    if (current === stored) return
    if (documentText(document.value).length > TEXT_LIMIT.createPost.document.maxLength) return

    saving.value = true
    failed.value = false

    try {
      if (isEmptyDocument(document.value)) {
        // An emptied composer means the draft is abandoned, and `text` may not be empty.
        if (draftId.value !== undefined) {
          await deletePost(toValue(groupId), toValue(threadId), draftId.value)
          draftId.value = undefined
          savedOnce.value = false
        }
      } else if (draftId.value === undefined) {
        const created = await createPost(toValue(groupId), toValue(threadId), {
          document: document.value as Record<string, unknown>,
          isDraft: true,
        })
        if (created.status === 201) draftId.value = created.data.id
        savedOnce.value = true
      } else {
        await updatePost(toValue(groupId), toValue(threadId), draftId.value, {
          document: document.value as Record<string, unknown>,
        })
        savedOnce.value = true
      }
      stored = current
    } catch {
      // The text is never cleared on failure, and the next keystroke tries again.
      failed.value = true
    } finally {
      saving.value = false
    }
  }

  /**
   * Two seconds after typing stops, and at least every ten while it continues. The ceiling is
   * what keeps a long stretch of writing from spending the shared rate-limit budget — it is
   * 300 requests per fifteen minutes and counted per address, so a household shares one.
   */
  watchDebounced(document, save, { debounce: 2_000, maxWait: 10_000, deep: true })

  watch([() => toValue(groupId), () => toValue(threadId)], load, { immediate: true })

  // A closed tab or a backgrounded phone would otherwise drop whatever came after the last
  // save. `keepalive` lets the request outlive the page.
  useEventListener(globalThis, 'pagehide', flush)
  useEventListener(globalThis.document, 'visibilitychange', () => {
    if (globalThis.document.visibilityState === 'hidden') flush()
  })

  function flush() {
    const current = JSON.stringify(document.value)
    if (!loaded.value || current === stored || isEmptyDocument(document.value)) return
    if (draftId.value === undefined) return

    const url = `/api/groups/${toValue(groupId)}/threads/${toValue(threadId)}/posts/${draftId.value}`
    globalThis
      .fetch(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document: document.value }),
        credentials: 'same-origin',
        keepalive: true,
      })
      .catch(() => undefined)
  }

  /** Called once a draft has been published, so nothing tries to save it again. */
  function forget() {
    draftId.value = undefined
    savedOnce.value = false
    failed.value = false
    stored = ''
  }

  return { status, draftId, loaded, forget }
}
