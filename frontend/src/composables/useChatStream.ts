import type { Ref } from 'vue'
import { onScopeDispose, ref } from 'vue'
import { useEventListener } from '@vueuse/core'

/** What the backend pushes down the stream. Mirrors `ChatEvent` in `chat/chat_events.ts`. */
export type ChatStreamEvent = {
  chatGroupId: string
  message: {
    id: string
    chatGroupId: string
    text: string
    createdAt: string
    createdBy: string | null
    createdByUsername: string | null
  }
}

/**
 * How long to wait before building a new `EventSource`. The first step is short because the
 * common cause is a deploy, which is over in seconds; past the end of the ladder it holds at
 * the ceiling, which keeps a longer outage down to two attempts a minute per open tab.
 */
const RECONNECT_DELAYS_MS = [2_000, 4_000, 8_000, 16_000] as const
const MAX_RECONNECT_DELAY_MS = 30_000

/** `EventSource.readyState` when the browser has given up and will not reconnect. */
const CLOSED = 2

/**
 * One `EventSource` for every chat the member is in.
 *
 * `EventSource` reconnects by itself, but only after a dropped connection. A response that is
 * not a 200 — Caddy's 502 while the backend container restarts, say — is fatal per the spec:
 * the browser closes the stream and never tries again, so before this every deploy left chat
 * silently dead until the page was reloaded. Hence the reconnection below, which is only for
 * that case; a plain drop is still left to the browser.
 *
 * What no reconnection can do is say what arrived while it was away, which is why `connected`
 * flips to false and back and the caller refetches on the way back up rather than the server
 * replaying events. That is also what makes the in-process fan-out on the server safe to
 * replace later: a member catches up on anything a switchover dropped.
 *
 * Cookies go automatically because the stream is same-origin; `EventSource` cannot set
 * headers, so the session cookie is the only way this could have been authenticated.
 */
export function useChatStream(onMessage: (event: ChatStreamEvent) => void): {
  connected: Ref<boolean>
} {
  const connected = ref<boolean>(false)

  let source: EventSource | undefined
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  function clearTimer(): void {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  function open(): void {
    if (disposed) {
      return
    }

    source?.close()
    const current = new EventSource('/api/chats/events')
    source = current

    current.addEventListener('ready', () => {
      // Only now is the stream carrying anything, so this is what the caller waits for.
      attempt = 0
      connected.value = true
    })

    current.addEventListener('chat-message', (event) => {
      try {
        onMessage(JSON.parse((event as MessageEvent).data) as ChatStreamEvent)
      } catch {
        // A payload this cannot read is not worth taking the stream down for.
      }
    })

    current.addEventListener('error', () => {
      // Fired on every disconnect, including the ones EventSource is about to retry itself.
      connected.value = false

      // Only a closed stream is ours to rebuild. While it is reconnecting on its own,
      // stepping in would leave two streams open and double every message.
      if (current.readyState === CLOSED) {
        scheduleReconnect()
      }
    })
  }

  function scheduleReconnect(): void {
    if (disposed || timer !== undefined) {
      return
    }

    const base = RECONNECT_DELAYS_MS[attempt] ?? MAX_RECONNECT_DELAY_MS
    attempt += 1

    // A deploy closes every open tab's stream in the same instant, so without a spread they
    // would all come back in the same instant too.
    const delay = base * (0.8 + Math.random() * 0.4)

    timer = setTimeout(() => {
      timer = undefined
      open()
    }, delay)
  }

  /** Straight away rather than on the backoff, because somebody is now looking at it. */
  function reconnectNow(): void {
    clearTimer()
    attempt = 0
    open()
  }

  // A backgrounded phone keeps the connection but stops delivering, and a tab that was hidden
  // through an outage is sitting on a dead stream. Either way, coming back is a reconnection.
  useEventListener(globalThis.document, 'visibilitychange', () => {
    if (globalThis.document.visibilityState !== 'visible') {
      return
    }
    if (source === undefined || source.readyState === CLOSED) {
      connected.value = false
      reconnectNow()
    }
  })

  open()

  onScopeDispose(() => {
    disposed = true
    clearTimer()
    source?.close()
  })

  return { connected }
}
