import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseError } from "pg";
import { formatLogLine } from "#/src/logging.ts";

function logged(properties: Record<string, unknown>): Record<string, unknown> {
  const line = formatLogLine({
    category: ["calliope"],
    level: "error",
    message: ["Request failed"],
    rawMessage: "Request failed",
    timestamp: 0,
    properties,
  });
  return JSON.parse(line).properties;
}

test("an error is written as its name, message and stack", () => {
  const error = new Error("boom");

  assert.deepEqual(logged({ error }).error, {
    name: "Error",
    message: "boom",
    stack: error.stack,
  });
});

test("a database error keeps its stack and leaves the row's values out", () => {
  // What pg throws for a unique violation, which names the protocol message, "error".
  const error = new DatabaseError(
    'duplicate key value violates unique constraint "user_email_address_key"',
    0,
    "error",
  );
  error.code = "23505";
  error.detail = "Key (email_address)=(member@example.com) already exists.";

  assert.deepEqual(logged({ error }).error, {
    name: "error",
    message: 'duplicate key value violates unique constraint "user_email_address_key"',
    stack: error.stack,
    code: "23505",
  });
});

test("a cause is spelled out the same way", () => {
  const cause = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED", port: 1 });
  const error = new TypeError("fetch failed", { cause });

  assert.deepEqual(logged({ error }).error, {
    name: "TypeError",
    message: "fetch failed",
    stack: error.stack,
    cause: {
      name: "Error",
      message: "connect ECONNREFUSED",
      stack: cause.stack,
      code: "ECONNREFUSED",
    },
  });
});

test("something thrown that is not an error still reaches the line", () => {
  assert.deepEqual(logged({ error: undefined }).error, { message: "undefined" });
  assert.deepEqual(logged({ error: "refused" }).error, { message: "refused" });
});

test("other properties are written as they are", () => {
  assert.deepEqual(logged({ count: 3, signal: "SIGTERM" }), { count: 3, signal: "SIGTERM" });
});
