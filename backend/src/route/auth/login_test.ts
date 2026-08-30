import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { authFixture, password, postJson } from "@/src/test/auth.ts";
import { INVALID_CREDENTIALS_MESSAGE } from "@/src/http/response.ts";
import { UserService } from "@/src/service/user_service.ts";
import { TEXT_MINIMUM } from "@/src/text_limit.ts";

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

/**
 * The minimum applies where a password is chosen, never where one is proved. An account made
 * before the rule existed has to keep working — enforcing it here would lock its owner out, and
 * the refusal would announce the rule to whoever typed it.
 */
Deno.test("an account whose password predates the minimum can still sign in", async () => {
  const short = "x".repeat(TEXT_MINIMUM.password - 1);
  const shortUsername = "login-short-password-user";
  await deleteUsers([shortUsername]);
  await UserService.insertUser(
    shortUsername,
    short,
    `${shortUsername}@example.test`,
  );

  const response = await postJson("/api/auth/login", {
    login: shortUsername,
    password: short,
  });

  assertEquals(response.status, STATUS_CODE.OK);
  assertExists(response.headers.get("set-cookie"));
  await deleteUsers([shortUsername]);
});
