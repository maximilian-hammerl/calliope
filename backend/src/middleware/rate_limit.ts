import type { Context } from "hono";
import { clientAddress } from "@/src/util/client_address.ts";
import { rateLimiter, RedisStore } from "hono-rate-limiter";
import { rateLimiterRedisClient } from "@/src/redis/client.ts";
import type { RateLimitScope } from "@/src/http/response.ts";
import { isReadMethod } from "@/src/http/method.ts";

/**
 * Liveness probes run far more often than the limit allows — one every three seconds
 * would exhaust it — so they are not counted.
 */
const UNCOUNTED_PATHS = new Set(["/api/health"]);

/** Exported so tests can clear the counters they generate. Both budgets sit under it. */
export const RATE_LIMIT_KEY_PREFIX = "rate-limit:";

const WINDOW = Temporal.Duration.from({ minutes: 15 });

/**
 * Two budgets rather than one, so spending either leaves the other alone: a member who has read
 * a lot can still post, and one who has written a lot can still read. Sharing one budget is what
 * made an afternoon of reading lock somebody out of their own composer.
 *
 * **Both numbers are sized from measurement, and the writing one is the larger surprise.** One
 * thread page costs eleven reads, so 500 is about forty-five page loads in the window — and the
 * address is the key, so a household divides it. Writing looks rare until the composer is counted:
 * autosave is a `PATCH` on a two-second debounce with a ten-second ceiling, which is ninety saves
 * in a window of steady writing and past two hundred in bursts. A tight write budget would stop
 * the composer saving, which is the one failure this platform cannot have.
 */
export const READ_REQUESTS_PER_WINDOW = 500;
export const WRITE_REQUESTS_PER_WINDOW = 250;

function isRead(c: Context): boolean {
  return isReadMethod(c.req.method);
}

function budget(
  scope: RateLimitScope,
  limit: number,
  countsThisRequest: (c: Context) => boolean,
) {
  return rateLimiter({
    windowMs: WINDOW.total("milliseconds"),
    limit,
    standardHeaders: "draft-7",
    keyGenerator: (c) => clientAddress(c) ?? "unknown",
    // Each budget skips what the other counts, so a request only ever touches one — which is also
    // what keeps the `RateLimit` headers coherent: the skipped one sets none.
    skip: (c) => UNCOUNTED_PATHS.has(c.req.path) || !countsThisRequest(c),
    // The scope travels in the body, because the client says something different for each and
    // reading it off the limit in the header would break the day a number changes.
    message: { error: "Too many requests", scope },
    store: new RedisStore({
      client: rateLimiterRedisClient,
      prefix: `${RATE_LIMIT_KEY_PREFIX}${scope}:`,
    }),
  });
}

export const readRateLimit = budget("read", READ_REQUESTS_PER_WINDOW, isRead);

export const writeRateLimit = budget(
  "write",
  WRITE_REQUESTS_PER_WINDOW,
  (c) => !isRead(c),
);
