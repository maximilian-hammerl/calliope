import { onScopeDispose, ref, type Ref } from 'vue'
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
 * One `EventSource` for every chat the member is in.
 *
 * `EventSource` reconnects by itself, so nothing here retries. What it cannot do is tell you
 * what arrived while it was away — which is why `connected` flips to false and back, and the
 * caller refetches on the way back up rather than the server replaying events. That is also
 * what makes the in-process fan-out on the server safe to replace later: a member catches up
 * on anything a switchover dropped.
 *
 * Cookies go automatically because the stream is same-origin; `EventSource` cannot set
 * headers, so the session cookie is the only way this could have been authenticated.
 */
export function useChatStream(onMessage: (event: ChatStreamEvent) => void): {
  connected: Ref<boolean>
} {
  const connected = ref<boolean>(false)
  const source = new EventSource('/api/chats/events')

  source.addEventListener('ready', () => {
    connected.value = true
  })

  source.addEventListener('chat-message', (event) => {
    try {
      onMessage(JSON.parse((event as MessageEvent).data) as ChatStreamEvent)
    } catch {
      // A payload this cannot read is not worth taking the stream down for.
    }
  })

  source.addEventListener('error', () => {
    // Fired on every disconnect, including the ones EventSource is about to retry itself.
    connected.value = false
  })

  // A backgrounded phone keeps the connection but stops delivering; treat coming back as a
  // reconnection so the caller refetches.
  useEventListener(globalThis.document, 'visibilitychange', () => {
    if (globalThis.document.visibilityState === 'visible' && source.readyState === 2) {
      connected.value = false
    }
  })

  onScopeDispose(() => source.close())

  return { connected }
}
