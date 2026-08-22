import type { Context } from "hono";
import { getConnInfo } from "hono/deno";

/**
 * The client's address, as far behind the reverse proxy as it can be trusted.
 *
 * One resolver on purpose: the rate limiter buckets by this and a session records it, and a
 * second implementation that *appended* to `X-Forwarded-For` instead of reading the first entry
 * would let a client pick its own bucket by sending the header. Caddy overwrites the header
 * (see the `Caddyfile`), which is what makes the first entry the real one.
 */
export function clientAddress(c: Context): string | undefined {
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor !== undefined) {
    return (forwardedFor.split(",")[0] ?? forwardedFor).trim();
  }

  try {
    return getConnInfo(c).remote.address;
  } catch {
    // No connection info, for example when the app is driven directly in tests.
    return undefined;
  }
}
