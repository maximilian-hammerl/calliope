import type { ComputedRef, Ref } from 'vue'
import { rateLimitedUntil } from '@/lib/api/queryClient'
import { computed, ref, toValue, watch } from 'vue'
import { useEventListener, watchDebounced } from '@vueuse/core'
import type { PostDocument } from '@/api/models'
import { createPost, deletePost, listPosts, updatePost } from '@/api/posts/posts'
import { TEXT_LIMIT } from '@/api/textLimit'
import { sameDocument } from '@/lib/document/sameDocument'

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
  document: Ref<PostDocument>,
  /** The document's prose, which decides whether the composer counts as empty. */
  text: Ref<string>,
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

  /**
   * What the server currently holds, so an unchanged draft is never written again. Comparing the
   * *document* rather than its prose matters: bolding a word changes no text, and a text comparison
   * would decide there was nothing to save.
   */
  let storedDocument: PostDocument | undefined

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
    storedDocument = undefined

    try {
      // At most one draft per member per thread, enforced by a partial unique index.
      const response = await listPosts(toValue(groupId), toValue(threadId), {
        isDraft: true,
        limit: 1,
      })
      const existing = response.status === 200 ? response.data.results[0] : undefined
      if (existing !== undefined) {
        draftId.value = existing.id
        storedDocument = existing.document
        document.value = existing.document
        // The server's own projection, so the client needs no second walker to know the prose.
        text.value = existing.text
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

    const current = document.value
    if (storedDocument !== undefined && sameDocument(current, storedDocument)) return
    if (text.value.trim().length > TEXT_LIMIT.createPost.document.maxLength) return

    // Nothing to gain from asking while the write budget is spent, and every keystroke would ask
    // again — a save is a `PATCH`, so it is that budget and not the reading one. `failed` stays
    // set, so the composer keeps saying the draft is unsaved, which it is.
    const writesLimitedUntil = rateLimitedUntil.value.write
    if (writesLimitedUntil !== undefined && writesLimitedUntil > Date.now()) {
      failed.value = true
      return
    }

    saving.value = true
    failed.value = false

    try {
      if (text.value.trim().length === 0) {
        // An emptied composer means the draft is abandoned, and a post may not be empty.
        if (draftId.value !== undefined) {
          await deletePost(toValue(groupId), toValue(threadId), draftId.value)
          draftId.value = undefined
          savedOnce.value = false
        }
      } else if (draftId.value === undefined) {
        const created = await createPost(toValue(groupId), toValue(threadId), {
          document: document.value,
          isDraft: true,
        })
        if (created.status === 201) draftId.value = created.data.id
        savedOnce.value = true
      } else {
        await updatePost(toValue(groupId), toValue(threadId), draftId.value, {
          document: document.value,
        })
        savedOnce.value = true
      }
      storedDocument = current
    } catch {
      // The document is never cleared on failure, and the next keystroke tries again.
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
  watchDebounced(document, save, { debounce: 2_000, maxWait: 10_000 })

  watch([() => toValue(groupId), () => toValue(threadId)], load, { immediate: true })

  // A closed tab or a backgrounded phone would otherwise drop whatever came after the last
  // save. `keepalive` lets the request outlive the page.
  useEventListener(globalThis, 'pagehide', flush)
  useEventListener(globalThis.document, 'visibilitychange', () => {
    if (globalThis.document.visibilityState === 'hidden') flush()
  })

  function flush() {
    const current = document.value
    if (!loaded.value) return
    if (storedDocument !== undefined && sameDocument(current, storedDocument)) return
    if (text.value.trim().length === 0 || draftId.value === undefined) return

    // The generated function, with `keepalive` passed through as a `RequestInit` — so the URL,
    // the body's type and the error shape all still come from the client. This was a hand-written
    // `fetch` until it was noticed that an unchecked body is exactly how it went on sending
    // `{ text }` for a while after the API stopped accepting it.
    //
    // Nothing is done with a failure on purpose: the page is going away, and there is nobody left
    // to tell. The next load reads the draft the server does have.
    updatePost(
      toValue(groupId),
      toValue(threadId),
      draftId.value,
      { document: document.value },
      { keepalive: true },
    ).catch(() => undefined)
  }

  /** Called once a draft has been published, so nothing tries to save it again. */
  function forget() {
    draftId.value = undefined
    savedOnce.value = false
    failed.value = false
    storedDocument = undefined
  }

  return { status, draftId, loaded, forget }
}
