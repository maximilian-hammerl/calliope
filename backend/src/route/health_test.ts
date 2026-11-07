import { test } from "node:test";
import assert from "node:assert/strict";
import { APP_NAME } from "@/src/branding.ts";
import { STATUS_CODE } from "@/src/http/status.ts";
import app from "@/src/app.ts";
import { API_VERSION } from "@/src/open_api_specification.ts";
import type { DatabaseHealth } from "@/src/operations/database_health.ts";
import { SAME_ORIGIN } from "@/src/test/support.ts";

test("GET /api/health reports a healthy application without a session", async () => {
  const response = await app.request("/api/health");

  assert.equal(response.status, STATUS_CODE.OK);
  const body = await response.json();

  assert.deepEqual(body.health, { databases: true });
  assert.equal(body.application.name, APP_NAME);
  assert.equal(body.application.version, API_VERSION);
  assert.equal(body.application.hostname, "localhost");
  // An ISO 8601 duration, so the value stays parseable by whatever polls this.
  assert.match(body.application.uptime, /^PT[\d.]+S$/);
  assert.ok(Temporal.Instant.from(body.application.datetime));
});

test("GET /api/health reports every database separately", async () => {
  const response = await app.request("/api/health");
  const databases: Array<DatabaseHealth> = (await response.json()).databases;

  assert.deepEqual(databases.map((database) => database.name), [
    "postgres",
    "redis",
  ]);

  for (const database of databases) {
    assert.equal(database.health, true);
    assert.equal(database.essential, true);
    assert.equal(database.error, undefined);
    assert.equal(typeof database.latency, "number");
  }
});

test("GET /api/health is not counted against the rate limit", async () => {
  // Probes poll far more often than the limit allows, so no budget may be spent.
  const response = await app.request("/api/health");

  assert.equal(response.headers.get("ratelimit"), null);
  assert.equal(response.headers.get("ratelimit-policy"), null);
});

test("POST /api/health is rejected", async () => {
  const response = await app.request("/api/health", {
    method: "POST",
    headers: SAME_ORIGIN,
  });

  assert.equal(response.status, STATUS_CODE.MethodNotAllowed);
});
