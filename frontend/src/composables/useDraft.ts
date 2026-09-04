import type { ComputedRef, Ref } from 'vue'
import { rateLimitedUntil } from '@/lib/api/queryClient'
import { computed, ref, toValue, watch } from 'vue'
import { useEventListener, watchDebounced } from '@vueuse/core'
import type { PostDocument } from '@/api/models'

import { TEXT_LIMIT } from '@/api/textLimit'
import { sameDocument } from '@/lib/document/sameDocument'

export type DraftStatus = 'idle' | 'saving' | 'saved' | 'failed'

/**
 * The four calls a draft needs, supplied by whoever owns the thread: a writing group's posts, or
 * the public forum's (#32). An adapter rather than a second copy of this composable — the
 * three-way distinction between autosaving, publishing and editing is the subtle part, and two
 * implementations of it would drift.
 *
 * They speak in meanings rather than in responses, so narrowing the generated client's union
 * stays at the call site where the rest of this codebase does it — and so a scope whose endpoints
 * answer differently cannot quietly change what a draft is.
 */
export type DraftEndpoints = {
  /** This member's own draft in this thread, or nothing if they have none. */
  load: () => Promise<{ id: string; document: PostDocument; text: string } | undefined>
  /** The new draft's id, or nothing if the server refused. */
  create: (document: PostDocument) => Promise<string | undefined>
  update: (
    postId: string,
    document: PostDocument,
    options?: { keepalive: true },
  ) => Promise<unknown>
  remove: (postId: string) => Promise<unknown>
}

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
  /** What the draft belongs to: a change reloads, so navigating between threads is clean. */
  threadId: Ref<string> | (() => string),
  endpoints: DraftEndpoints,
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
      const existing = await endpoints.load()
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
          await endpoints.remove(draftId.value)
          draftId.value = undefined
          savedOnce.value = false
        }
      } else if (draftId.value === undefined) {
        draftId.value = await endpoints.create(document.value)
        savedOnce.value = true
      } else {
        await endpoints.update(draftId.value, document.value)
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

  watch(() => toValue(threadId), load, { immediate: true })

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
    endpoints.update(draftId.value, document.value, { keepalive: true }).catch(() => undefined)
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
