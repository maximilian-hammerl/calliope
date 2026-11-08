import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { BreachedPasswordService } from "@/src/service/breached_password_service.ts";
import { STATUS_CODE } from "@/src/http/status.ts";
import app from "@/src/app.ts";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { authFixture, password, postJson } from "@/src/test/auth.ts";
import { TEXT_MINIMUM } from "@/src/text_limit.ts";
import { PASSWORD_BREACHED } from "@/src/http/response.ts";

// Its own account, so a file running beside this one cannot register or delete it.
const { emailAddress, register, username } = authFixture("register");

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([username]));

test("POST /api/auth/register creates a user and starts a session", async () => {
  const response = await register();

  assert.equal(response.status, STATUS_CODE.OK);
  assert.deepEqual(await response.json(), { ok: true });
  assert.ok(response.headers.get("set-cookie"));
});

test("POST /api/auth/register rejects an already registered user", async () => {
  assert.equal((await register()).status, STATUS_CODE.OK);

  const response = await register();

  assert.equal(response.status, STATUS_CODE.Conflict);
  assert.deepEqual(await response.json(), {
    error: "Username or email address already in use",
  });
});

test("POST /api/auth/register reports every schema violation", async () => {
  const response = await postJson("/api/auth/register", {
    username: "",
    password: "",
    emailAddress: "not-an-email",
  });

  assert.equal(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assert.equal(body.error, "Invalid request");
  // All three fields are reported, so validation is not short-circuited. Distinct and sorted:
  // the order follows the schema's keys and carries no meaning, and one field may fail more than
  // one check — an empty username is both too short and blank.
  assert.deepEqual(
    [
      ...new Set(body.issues.map((issue: { path: string }) => issue.path)),
    ].toSorted(),
    ["emailAddress", "password", "username"],
  );
});

test("POST /api/auth/register accepts what a browser accepts", async () => {
  // The schema uses the same pattern as input[type=email], so an address the form let
  // through cannot be refused here. This one is rejected by Zod's stricter default.
  const response = await postJson("/api/auth/register", {
    username,
    password,
    emailAddress: "a@b",
  });

  assert.equal(response.status, STATUS_CODE.OK);
});

test("POST /api/auth/register reports a malformed body as JSON", async () => {
  // Hono raises an HTTPException here rather than reaching the validator, so this only
  // matches the documented shape because of the global error handler.
  const response = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not valid json",
  });

  assert.equal(response.status, STATUS_CODE.BadRequest);
  assert.equal(response.headers.get("content-type"), "application/json");
  assert.deepEqual(await response.json(), {
    error: "Malformed JSON in request body",
  });
});

test("POST /api/auth/register refuses an oversized field", async () => {
  const response = await postJson("/api/auth/register", {
    username: "x".repeat(33),
    password,
    emailAddress,
  });

  assert.equal(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assert.deepEqual(body.issues.map((issue: { path: string }) => issue.path), [
    "username",
  ]);
});

test("POST /api/auth/register refuses a two-character username", async () => {
  // Matched to the search minimum: a shorter name could never be found, and so its owner
  // could never be invited to a group.
  const response = await postJson("/api/auth/register", {
    username: "xy",
    password,
    emailAddress,
  });

  assert.equal(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assert.deepEqual(body.issues.map((issue: { path: string }) => issue.path), [
    "username",
  ]);
});

test("POST /api/auth/register refuses a password below the minimum", async () => {
  const response = await postJson("/api/auth/register", {
    username,
    emailAddress,
    password: "x".repeat(TEXT_MINIMUM.password - 1),
  });

  assert.equal(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assert.equal(
    body.issues.some((issue: { path: string }) => issue.path === "password"),
    true,
  );
});

test("POST /api/auth/register accepts a password exactly at the minimum", async () => {
  const response = await postJson("/api/auth/register", {
    username,
    emailAddress,
    password: "x".repeat(TEXT_MINIMUM.password),
  });

  assert.equal(response.status, STATUS_CODE.OK);
});

test("POST /api/auth/register refuses a password from a known breach", async (t) => {
  const isBreached = t.mock.method(
    BreachedPasswordService,
    "isBreached",
    () => Promise.resolve(true),
  );

  const response = await postJson("/api/auth/register", {
    username,
    emailAddress,
    password,
  });

  assert.equal(response.status, STATUS_CODE.UnprocessableEntity);
  assert.equal((await response.json()).code, PASSWORD_BREACHED);
  assert.deepEqual(isBreached.mock.calls.map((call) => call.arguments), [
    [password],
  ]);
});
