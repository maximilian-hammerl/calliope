import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { authFixture, password, postJson } from "@/src/test/auth.ts";
import { INVALID_CREDENTIALS_MESSAGE } from "@/src/http/response.ts";

// Its own account, so a file running beside this one cannot register or delete it.
const { emailAddress, register, username } = authFixture("login");

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
  // The frontend tells a wrong password from a lost session by this code, not the message.
  // The code is asserted as a literal on purpose: it is what a client discriminates on, so
  // renaming it has to fail here. The message is only text and comes from the constant.
  assertEquals(await response.json(), {
    error: INVALID_CREDENTIALS_MESSAGE,
    code: "invalid_credentials",
  });
});
