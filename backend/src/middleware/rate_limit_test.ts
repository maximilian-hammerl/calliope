import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { Hono } from "hono";
import { redis } from "@/src/redis/client.ts";
import { RATE_LIMIT_TEST_CLIENTS } from "@/src/test/support.ts";
import {
  RATE_LIMIT_KEY_PREFIX,
  READ_REQUESTS_PER_WINDOW,
  readRateLimit,
  WRITE_REQUESTS_PER_WINDOW,
  writeRateLimit,
} from "./rate_limit.ts";

// A bare app, so the limiters are measured without any route work in the way.
const app = new Hono()
  .use(readRateLimit)
  .use(writeRateLimit)
  .get("/probe", (c) => c.json({ ok: true }))
  .post("/probe", (c) => c.json({ ok: true }));

/**
 * Each test uses its own client address, so the tests cannot exhaust each other's budget, and
 * all of them sit in the block `clearRateLimits` is documented to spare.
 */
function request(clientAddress: string, method: "GET" | "POST" = "GET") {
  assertEquals(clientAddress.startsWith(RATE_LIMIT_TEST_CLIENTS), true);
  return app.request("/probe", {
    method,
    headers: { "x-forwarded-for": clientAddress },
  });
}

/** Spends a whole budget, so what is left of the other one can be asked about. */
async function exhaust(
  clientAddress: string,
  method: "GET" | "POST",
  requests: number,
) {
  for (let sent = 0; sent < requests; sent++) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose: the counter is the thing here
    assertEquals((await request(clientAddress, method)).status, STATUS_CODE.OK);
  }
}

Deno.test.afterEach(async () => {
  const keys = await redis.keys(`${RATE_LIMIT_KEY_PREFIX}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
});

Deno.test("a read reports the read budget, and a write the write budget", async () => {
  const readHeader = (await request("198.51.100.1")).headers.get("ratelimit");
  assertExists(readHeader, "expected draft-7 RateLimit headers");
  assertEquals(
    readHeader,
    `limit=${READ_REQUESTS_PER_WINDOW}, remaining=${
      READ_REQUESTS_PER_WINDOW - 1
    }, reset=900`,
  );

  // A separate address, so the read above cannot be what this one is counting.
  const writeHeader = (await request("198.51.100.2", "POST")).headers.get(
    "ratelimit",
  );
  assertExists(writeHeader);
  assertEquals(
    writeHeader,
    `limit=${WRITE_REQUESTS_PER_WINDOW}, remaining=${
      WRITE_REQUESTS_PER_WINDOW - 1
    }, reset=900`,
  );
});

/**
 * The point of splitting them. Reading all afternoon used to leave a member unable to save a
 * draft, which for a writing platform is the one failure that matters.
 */
Deno.test("spending the read budget leaves writing possible", async () => {
  const clientAddress = "198.51.100.3";
  await exhaust(clientAddress, "GET", READ_REQUESTS_PER_WINDOW);

  const refused = await request(clientAddress);
  assertEquals(refused.status, STATUS_CODE.TooManyRequests);
  assertEquals(await refused.json(), {
    error: "Too many requests",
    scope: "read",
  });

  assertEquals((await request(clientAddress, "POST")).status, STATUS_CODE.OK);
});

Deno.test("spending the write budget leaves reading possible", async () => {
  const clientAddress = "198.51.100.4";
  await exhaust(clientAddress, "POST", WRITE_REQUESTS_PER_WINDOW);

  const refused = await request(clientAddress, "POST");
  assertEquals(refused.status, STATUS_CODE.TooManyRequests);
  assertEquals(await refused.json(), {
    error: "Too many requests",
    scope: "write",
  });

  assertEquals((await request(clientAddress)).status, STATUS_CODE.OK);
});

Deno.test("a different client has its own budget", async () => {
  const clientAddress = "198.51.100.5";
  await exhaust(clientAddress, "GET", READ_REQUESTS_PER_WINDOW);

  assertEquals(
    (await request(clientAddress)).status,
    STATUS_CODE.TooManyRequests,
  );
  assertEquals((await request("198.51.100.6")).status, STATUS_CODE.OK);
});
