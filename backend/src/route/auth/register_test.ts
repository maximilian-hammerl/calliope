import { assertSpyCall, assertSpyCalls, stub } from "@std/testing/mock";
import { BreachedPasswordService } from "@/src/service/breached_password_service.ts";
import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import app from "@/src/app.ts";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { authFixture, password, postJson } from "@/src/test/auth.ts";
import { TEXT_MINIMUM } from "@/src/text_limit.ts";
import { PASSWORD_BREACHED } from "@/src/http/response.ts";

// Its own account, so a file running beside this one cannot register or delete it.
const { emailAddress, register, username } = authFixture("register");

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([username]));

Deno.test("POST /api/auth/register creates a user and starts a session", async () => {
  const response = await register();

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { ok: true });
  assertExists(response.headers.get("set-cookie"));
});

Deno.test("POST /api/auth/register rejects an already registered user", async () => {
  assertEquals((await register()).status, STATUS_CODE.OK);

  const response = await register();

  assertEquals(response.status, STATUS_CODE.Conflict);
  assertEquals(await response.json(), {
    error: "Username or email address already in use",
  });
});

Deno.test("POST /api/auth/register reports every schema violation", async () => {
  const response = await postJson("/api/auth/register", {
    username: "",
    password: "",
    emailAddress: "not-an-email",
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assertEquals(body.error, "Invalid request");
  // All three fields are reported, so validation is not short-circuited. Distinct and sorted:
  // the order follows the schema's keys and carries no meaning, and one field may fail more than
  // one check — an empty username is both too short and blank.
  assertEquals(
    [
      ...new Set(body.issues.map((issue: { path: string }) => issue.path)),
    ].toSorted(),
    ["emailAddress", "password", "username"],
  );
});

Deno.test("POST /api/auth/register accepts what a browser accepts", async () => {
  // The schema uses the same pattern as input[type=email], so an address the form let
  // through cannot be refused here. This one is rejected by Zod's stricter default.
  const response = await postJson("/api/auth/register", {
    username,
    password,
    emailAddress: "a@b",
  });

  assertEquals(response.status, STATUS_CODE.OK);
});

Deno.test("POST /api/auth/register reports a malformed body as JSON", async () => {
  // Hono raises an HTTPException here rather than reaching the validator, so this only
  // matches the documented shape because of the global error handler.
  const response = await app.request("/api/auth/register", {
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

Deno.test("POST /api/auth/register refuses an oversized field", async () => {
  const response = await postJson("/api/auth/register", {
    username: "x".repeat(33),
    password,
    emailAddress,
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assertEquals(body.issues.map((issue: { path: string }) => issue.path), [
    "username",
  ]);
});

Deno.test("POST /api/auth/register refuses a two-character username", async () => {
  // Matched to the search minimum: a shorter name could never be found, and so its owner
  // could never be invited to a group.
  const response = await postJson("/api/auth/register", {
    username: "xy",
    password,
    emailAddress,
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assertEquals(body.issues.map((issue: { path: string }) => issue.path), [
    "username",
  ]);
});

Deno.test("POST /api/auth/register refuses a password below the minimum", async () => {
  const response = await postJson("/api/auth/register", {
    username,
    emailAddress,
    password: "x".repeat(TEXT_MINIMUM.password - 1),
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assertEquals(
    body.issues.some((issue: { path: string }) => issue.path === "password"),
    true,
  );
});

Deno.test("POST /api/auth/register accepts a password exactly at the minimum", async () => {
  const response = await postJson("/api/auth/register", {
    username,
    emailAddress,
    password: "x".repeat(TEXT_MINIMUM.password),
  });

  assertEquals(response.status, STATUS_CODE.OK);
});

Deno.test("POST /api/auth/register refuses a password from a known breach", async () => {
  using isBreached = stub(
    BreachedPasswordService,
    "isBreached",
    () => Promise.resolve(true),
  );

  const response = await postJson("/api/auth/register", {
    username,
    emailAddress,
    password,
  });

  assertEquals(response.status, STATUS_CODE.UnprocessableEntity);
  assertEquals((await response.json()).code, PASSWORD_BREACHED);
  assertSpyCall(isBreached, 0, { args: [password] });
  assertSpyCalls(isBreached, 1);
});
