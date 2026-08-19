import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { clearRateLimits, deleteUsers } from "@/src/test_support.ts";
import {
  emailAddress,
  password,
  postJson,
  register,
  username,
} from "./auth_test_support.ts";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([username]));

Deno.test("POST /api/auth/login starts a session for valid credentials", async () => {
  await register();

  const response = await postJson("/api/auth/login", {
    login: username,
    password,
  });

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { ok: true });
  assertExists(response.headers.get("set-cookie"));
});

Deno.test("POST /api/auth/login accepts the email address in any case", async () => {
  await register();

  // Registration lower-cases the address before storing it, so an upper-cased one only
  // matches if the lookup normalises too.
  const response = await postJson("/api/auth/login", {
    login: emailAddress.toUpperCase(),
    password,
  });

  assertEquals(response.status, STATUS_CODE.OK);
  assertExists(response.headers.get("set-cookie"));
});

Deno.test("POST /api/auth/login rejects a wrong password", async () => {
  await register();

  const response = await postJson("/api/auth/login", {
    login: username,
    password: "not-the-password",
  });

  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertEquals(await response.json(), { error: "Invalid credentials" });
});
