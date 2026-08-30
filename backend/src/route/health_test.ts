import { APP_NAME } from "@/src/branding.ts";
import { assertEquals, assertExists, assertMatch } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import app from "@/src/app.ts";
import { API_VERSION } from "@/src/open_api_specification.ts";
import type { DatabaseHealth } from "@/src/operations/database_health.ts";
import { SAME_ORIGIN } from "@/src/test/support.ts";

Deno.test("GET /api/health reports a healthy application without a session", async () => {
  const response = await app.request("/api/health");

  assertEquals(response.status, STATUS_CODE.OK);
  const body = await response.json();

  assertEquals(body.health, { databases: true });
  assertEquals(body.application.name, APP_NAME);
  assertEquals(body.application.version, API_VERSION);
  assertEquals(body.application.hostname, "localhost");
  // An ISO 8601 duration, so the value stays parseable by whatever polls this.
  assertMatch(body.application.uptime, /^PT[\d.]+S$/);
  assertExists(Temporal.Instant.from(body.application.datetime));
});

Deno.test("GET /api/health reports every database separately", async () => {
  const response = await app.request("/api/health");
  const databases: Array<DatabaseHealth> = (await response.json()).databases;

  assertEquals(databases.map((database) => database.name), [
    "postgres",
    "redis",
  ]);

  for (const database of databases) {
    assertEquals(database.health, true);
    assertEquals(database.essential, true);
    assertEquals(database.error, undefined);
    assertEquals(typeof database.latency, "number");
  }
});

Deno.test("GET /api/health is not counted against the rate limit", async () => {
  // Probes poll far more often than the limit allows, so no budget may be spent.
  const response = await app.request("/api/health");

  assertEquals(response.headers.get("ratelimit"), null);
  assertEquals(response.headers.get("ratelimit-policy"), null);
});

Deno.test("POST /api/health is rejected", async () => {
  const response = await app.request("/api/health", {
    method: "POST",
    headers: SAME_ORIGIN,
  });

  assertEquals(response.status, STATUS_CODE.MethodNotAllowed);
});
