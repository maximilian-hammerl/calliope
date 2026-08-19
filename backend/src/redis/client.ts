import { Redis } from "ioredis";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { addShutdownSignalListener } from "@/src/util/shutdown_signal.ts";
import {
  type DatabaseHealth,
  probeDatabase,
} from "@/src/operations/database_health.ts";

export const redis = new Redis(getRequiredEnvVariable("REDIS_URL"));

// Without a listener ioredis emits an unhandled `error` event and takes the process down,
// which would stop the health endpoint from ever reporting Redis as unreachable.
redis.on("error", (error) => {
  console.error("Redis connection error", error);
});

export function redisHealthCheck(): Promise<DatabaseHealth> {
  return probeDatabase("redis", true, () => redis.ping());
}

export async function closeRedisConnection(): Promise<void> {
  console.log("Closing Redis connection before shutdown");
  await redis.quit();
  console.log("Successfully closed Redis connection");
}

addShutdownSignalListener(closeRedisConnection);

/**
 * hono-rate-limiter expects the Upstash-shaped client. ioredis passes the key count and
 * the keys as separate arguments instead, so `evalsha` has to be adapted.
 */
export const rateLimiterRedisClient = {
  scriptLoad: (script: string) =>
    redis.script("LOAD", script) as Promise<string>,
  evalsha: <TArgs extends unknown[], TData = unknown>(
    sha1: string,
    keys: string[],
    args: TArgs,
    // Redis sends every argument as a string anyway, so widening them here is lossless.
  ) =>
    redis.evalsha(
      sha1,
      keys.length,
      ...keys,
      ...args.map((argument) => String(argument)),
    ) as Promise<TData>,
  decr: (key: string) => redis.decr(key),
  del: (key: string) => redis.del(key),
};
