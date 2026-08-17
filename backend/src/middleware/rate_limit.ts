import type { Context } from "hono";
import { getConnInfo } from "hono/deno";
import { rateLimiter, RedisStore } from "hono-rate-limiter";
import { rateLimiterRedisClient } from "@/src/redis/client.ts";

/**
 * Liveness probes run far more often than the limit allows — one every three seconds
 * would exhaust it — so they are not counted.
 */
const UNCOUNTED_PATHS = new Set(["/api/health"]);

/** Exported so tests can clear the counters they generate. */
export const RATE_LIMIT_KEY_PREFIX = "rate-limit:";

const WINDOW = Temporal.Duration.from({ minutes: 15 });

/** Exported so the test does not have to restate the limit it is checking. */
export const REQUESTS_PER_WINDOW = 300;

/**
 * Behind the reverse proxy every connection comes from the proxy itself, so the client is
 * read from X-Forwarded-For. The proxy has to overwrite that header rather than append to
 * it, otherwise a client can pick its own bucket by sending the header.
 */
function getClientKey(c: Context): string {
  const forwardedFor = c.req.header("x-forwarded-for");
  if (forwardedFor !== undefined) {
    return forwardedFor.split(",")[0].trim();
  }

  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    // No connection info, for example when the app is driven directly in tests.
    return "unknown";
  }
}

export default rateLimiter({
  windowMs: WINDOW.total("milliseconds"),
  limit: REQUESTS_PER_WINDOW,
  standardHeaders: "draft-7",
  keyGenerator: getClientKey,
  skip: (c) => UNCOUNTED_PATHS.has(c.req.path),
  message: { error: "Too many requests" },
  store: new RedisStore({
    client: rateLimiterRedisClient,
    prefix: RATE_LIMIT_KEY_PREFIX,
  }),
});
