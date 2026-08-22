import { clientAddress } from "@/src/util/client_address.ts";
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

export default rateLimiter({
  windowMs: WINDOW.total("milliseconds"),
  limit: REQUESTS_PER_WINDOW,
  standardHeaders: "draft-7",
  keyGenerator: (c) => clientAddress(c) ?? "unknown",
  skip: (c) => UNCOUNTED_PATHS.has(c.req.path),
  message: { error: "Too many requests" },
  store: new RedisStore({
    client: rateLimiterRedisClient,
    prefix: RATE_LIMIT_KEY_PREFIX,
  }),
});
