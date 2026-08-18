/**
 * How a sent message reaches the streams of everyone else in the chat.
 *
 * Deliberately in-process: the sender's request and the recipients' open streams are held by
 * the same Deno process, because the backend runs as exactly one container. That makes this
 * correct today and far simpler than the alternative — no second Redis connection, no
 * subscribe/unsubscribe lifecycle, no reconnect handling of its own.
 *
 * **It stops being correct the moment a second backend instance exists**, and it fails
 * silently: a member connected to one instance simply never sees a message sent through the
 * other. The seam below is the whole point — swapping these two functions for a Redis pub/sub
 * pair is one file, and the client's refetch-on-reconnect means nobody loses anything across
 * the switch. `deployment/README.md` records the constraint where somebody would meet it.
 */

/** What a stream is told. The payload is the message itself, so no refetch is needed. */
export type ChatEvent = {
  chatGroupId: string;
  message: {
    id: string;
    text: string;
    createdAt: string;
    createdBy: string | null;
    createdByUsername: string | null;
  };
};

type Listener = (event: ChatEvent) => void;

/** One member may have several streams open — two tabs, a phone and a laptop. */
const listenersByUser = new Map<string, Set<Listener>>();

/** Returns the function that stops listening; the route calls it when the stream closes. */
export function subscribeToChatEvents(
  userId: string,
  listener: Listener,
): () => void {
  const listeners = listenersByUser.get(userId) ?? new Set<Listener>();
  listeners.add(listener);
  listenersByUser.set(userId, listeners);

  return () => {
    listeners.delete(listener);
    // Otherwise the map grows one empty set per member who ever connected.
    if (listeners.size === 0) {
      listenersByUser.delete(userId);
    }
  };
}

/**
 * Never throws: one broken stream must not fail the send that triggered it. The message is
 * already committed by the time this runs, so a listener that cannot be written to has only
 * lost its live update — the next fetch shows the message anyway.
 */
export function publishChatEvent(
  recipientIds: Array<string>,
  event: ChatEvent,
): void {
  for (const recipientId of recipientIds) {
    for (const listener of listenersByUser.get(recipientId) ?? []) {
      try {
        listener(event);
      } catch (error) {
        console.error("Failed to deliver a chat event", error);
      }
    }
  }
}

/** Exported for the test that asserts a closed stream stops receiving. */
export function countChatListeners(userId: string): number {
  return listenersByUser.get(userId)?.size ?? 0;
}
