import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import app from "@/src/app.ts";
import { db } from "@/src/database/client.ts";
import { redis } from "@/src/redis/client.ts";
import { RATE_LIMIT_KEY_PREFIX } from "@/src/middleware/rate_limit.ts";

const username = "route-test-user";
const password = "a-complex-password";
const emailAddress = "route-test-user@example.com";

function postJson(path: string, body?: unknown, cookie?: string) {
  return app.request(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie === undefined ? {} : { cookie }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const register = () =>
  postJson("/auth/register", { username, password, emailAddress });

/** Returns the `session=...` pair of a Set-Cookie header, ready to send back. */
function sessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assertExists(setCookie, "expected the response to set a session cookie");
  return setCookie.split(";")[0];
}

// Counters live in Redis and survive the process, so without this the suite would
// eventually rate-limit itself across repeated runs.
Deno.test.beforeEach(async () => {
  const keys = await redis.keys(`${RATE_LIMIT_KEY_PREFIX}*`);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
});

// The user row cascades to its sessions, so this cleans up everything a test created.
Deno.test.afterEach(async () => {
  await db.deleteFrom("user").where("username", "=", username).execute();
});

Deno.test("POST /auth/register creates a user and starts a session", async () => {
  const response = await register();

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { ok: true });
  assertExists(response.headers.get("set-cookie"));
});

Deno.test("POST /auth/register rejects an already registered user", async () => {
  assertEquals((await register()).status, STATUS_CODE.OK);

  const response = await register();

  assertEquals(response.status, STATUS_CODE.Conflict);
  assertEquals(await response.json(), {
    error: "Username or email address already in use",
  });
});

Deno.test("POST /auth/register reports every schema violation", async () => {
  const response = await postJson("/auth/register", {
    username: "",
    password: "",
    emailAddress: "not-an-email",
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assertEquals(body.error, "Invalid request");
  // All three fields are reported, so validation is not short-circuited. Sorted, because
  // the order follows the schema's keys and carries no meaning.
  assertEquals(
    body.issues.map((issue: { path: string }) => issue.path).toSorted(),
    ["emailAddress", "password", "username"],
  );
});

Deno.test("POST /auth/register reports a malformed body as JSON", async () => {
  // Hono raises an HTTPException here rather than reaching the validator, so this only
  // matches the documented shape because of the global error handler.
  const response = await app.request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not valid json",
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  assertEquals(response.headers.get("content-type"), "application/json");
  assertEquals(await response.json(), {
    error: "Malformed JSON in request body",
  });
});

Deno.test("POST /auth/login starts a session for valid credentials", async () => {
  await register();

  const response = await postJson("/auth/login", { username, password });

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { ok: true });
  assertExists(response.headers.get("set-cookie"));
});

Deno.test("POST /auth/login rejects a wrong password", async () => {
  await register();

  const response = await postJson("/auth/login", {
    username,
    password: "not-the-password",
  });

  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertEquals(await response.json(), { error: "Invalid credentials" });
});

Deno.test("POST /auth/logout ends an existing session", async () => {
  const cookie = sessionCookie(await register());

  const response = await postJson("/auth/logout", undefined, cookie);

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { ok: true });

  // The session is gone, so the same cookie no longer authenticates.
  const reused = await postJson("/auth/logout", undefined, cookie);
  assertEquals(reused.status, STATUS_CODE.Unauthorized);
});

Deno.test("POST /auth/logout rejects a request without a session", async () => {
  const response = await postJson("/auth/logout");

  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertEquals(await response.json(), { error: "Unauthorized" });
});
