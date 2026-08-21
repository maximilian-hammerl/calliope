import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { Hono } from "hono";
import { redis } from "@/src/redis/client.ts";
import { RATE_LIMIT_TEST_CLIENTS } from "@/src/test/support.ts";
import rateLimit, {
  RATE_LIMIT_KEY_PREFIX,
  REQUESTS_PER_WINDOW,
} from "./rate_limit.ts";

// A bare app, so the limiter is measured without any route work in the way.
const app = new Hono().use(rateLimit).get(
  "/probe",
  (c) => c.json({ ok: true }),
);

/**
 * Each test uses its own client address, so the tests cannot exhaust each other's budget, and
 * all of them sit in the block `clearRateLimits` is documented to spare.
 */
function request(clientAddress: string) {
  assertEquals(clientAddress.startsWith(RATE_LIMIT_TEST_CLIENTS), true);
  return app.request("/probe", {
    headers: { "x-forwarded-for": clientAddress },
  });
}

Deno.test.afterEach(async () => {
  const keys = await redis.keys(`${RATE_LIMIT_KEY_PREFIX}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
});

Deno.test("rateLimit allows a request within the window", async () => {
  const response = await request("198.51.100.1");

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { ok: true });

  const header = response.headers.get("ratelimit");
  assertExists(header, "expected draft-7 RateLimit headers");
  assertEquals(
    header,
    `limit=${REQUESTS_PER_WINDOW}, remaining=${
      REQUESTS_PER_WINDOW - 1
    }, reset=900`,
  );
});

Deno.test("rateLimit rejects the request after the window is exhausted", async () => {
  const clientAddress = "198.51.100.2";

  for (let sent = 0; sent < REQUESTS_PER_WINDOW; sent++) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    assertEquals((await request(clientAddress)).status, STATUS_CODE.OK);
  }

  const response = await request(clientAddress);

  assertEquals(response.status, STATUS_CODE.TooManyRequests);
  assertEquals(await response.json(), { error: "Too many requests" });

  // A different client still has its own budget.
  assertEquals((await request("198.51.100.3")).status, STATUS_CODE.OK);
});
