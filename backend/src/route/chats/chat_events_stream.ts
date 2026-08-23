import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import authenticated from "@/src/middleware/authenticated.ts";
import { subscribeToChatEvents } from "@/src/event/chat_events.ts";
import { addShutdownSignalListener } from "@/src/util/shutdown_signal.ts";

/**
 * One stream per member, carrying every chat they are in.
 *
 * Deliberately a plain Hono route rather than an OpenAPI one: the response is an endless
 * `text/event-stream`, which `createRoute` has no way to describe, and pretending it returns
 * JSON would put a lie in the specification and generate a client that cannot be used.
 *
 * Three things keep it alive in the places it would otherwise quietly die:
 *
 * - **A heartbeat**, because proxies close connections that say nothing. A comment line costs
 *   nothing and is ignored by `EventSource`.
 * - **Caddy must not buffer.** `flush_interval -1` is set in the Caddyfile; without it this
 *   works locally and delivers nothing in production.
 * - **Shutdown closes the streams.** Otherwise the process cannot exit and a deploy hangs
 *   until Docker kills it.
 */
const HEARTBEAT = Temporal.Duration.from({ seconds: 25 });

const openStreams = new Set<() => void>();

addShutdownSignalListener(() => {
  for (const close of openStreams) {
    close();
  }
  return Promise.resolve();
});

export default new Hono().get("/", authenticated, (c) => {
  const user = c.get("user");

  return streamSSE(c, async (stream) => {
    // The client reconnects on its own and refetches what it missed, so nothing here has to
    // replay events; `retry` only sets how soon it tries.
    await stream.writeSSE({ event: "ready", data: "", retry: 3_000 });

    let finish = () => {};
    const closed = new Promise<void>((resolve) => {
      finish = resolve;
    });

    const unsubscribe = subscribeToChatEvents(user.id, (event) => {
      // Not awaited: a listener that blocks would hold up the send that triggered it.
      void stream.writeSSE({
        event: "chat-message",
        data: JSON.stringify(event),
      });
    });

    const heartbeat = setInterval(() => {
      void stream.writeSSE({ event: "heartbeat", data: "" });
    }, HEARTBEAT.total("milliseconds"));

    const close = () => finish();
    openStreams.add(close);

    stream.onAbort(() => finish());

    try {
      await closed;
    } finally {
      clearInterval(heartbeat);
      unsubscribe();
      openStreams.delete(close);
    }
  });
});
