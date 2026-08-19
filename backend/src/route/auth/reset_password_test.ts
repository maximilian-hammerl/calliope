import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import app from "@/src/app.ts";
import { db } from "@/src/database/client.ts";
import { clearRateLimits, deleteUsers } from "@/src/test_support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import {
  deleteAllMail,
  tokenFromResetMail,
  waitForMail,
} from "@/src/mail/mailpit_test_support.ts";
import {
  emailAddress,
  password,
  postJson,
  register,
  sessionCookie,
  username,
} from "./auth_test_support.ts";

Deno.test.beforeEach(async () => {
  await clearRateLimits();
  await deleteAllMail();
});
Deno.test.afterEach(() => deleteUsers([username]));

const newPassword = "an-entirely-different-password";

/** Runs the half of the flow the tests below all need: register, ask, read the link. */
async function requestResetToken(): Promise<string> {
  await postJson("/api/auth/forgot-password", { login: emailAddress });
  await flushBackgroundWork();
  return tokenFromResetMail(await waitForMail(emailAddress));
}

const resetPassword = (token: string, to: string) =>
  postJson("/api/auth/reset-password", { token, password: to });

const login = (withPassword: string) =>
  postJson("/api/auth/login", { login: username, password: withPassword });

Deno.test("POST /api/auth/reset-password replaces the password", async () => {
  await register();
  const token = await requestResetToken();

  const response = await resetPassword(token, newPassword);
  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { ok: true });

  assertEquals((await login(newPassword)).status, STATUS_CODE.OK);
  // The point of the whole flow: whoever knew the old password no longer gets in.
  assertEquals((await login(password)).status, STATUS_CODE.Unauthorized);
});

Deno.test("POST /api/auth/reset-password ends every existing session", async () => {
  const cookie = sessionCookie(await register());

  // The session works before the reset, so the assertion afterwards fails for the right
  // reason rather than because the cookie was never valid.
  assertEquals(
    (await app.request("/api/auth/me", { headers: { cookie } })).status,
    STATUS_CODE.OK,
  );

  await resetPassword(await requestResetToken(), newPassword);

  assertEquals(
    (await app.request("/api/auth/me", { headers: { cookie } })).status,
    STATUS_CODE.Unauthorized,
  );
});

Deno.test("POST /api/auth/reset-password spends the token exactly once", async () => {
  await register();
  const token = await requestResetToken();

  assertEquals(
    (await resetPassword(token, newPassword)).status,
    STATUS_CODE.OK,
  );

  const second = await resetPassword(token, "a-third-password");
  assertEquals(second.status, STATUS_CODE.Gone);

  // The second attempt changed nothing, rather than merely reporting an error.
  assertEquals((await login(newPassword)).status, STATUS_CODE.OK);
});

Deno.test("POST /api/auth/reset-password rejects an expired token", async () => {
  await register();
  const token = await requestResetToken();

  await db
    .updateTable("userToken")
    .set({
      expiresAt: Temporal.Now.instant().subtract({ minutes: 1 }).toString(),
    })
    .where("purpose", "=", "password_reset")
    .execute();

  assertEquals(
    (await resetPassword(token, newPassword)).status,
    STATUS_CODE.Gone,
  );
  assertEquals((await login(password)).status, STATUS_CODE.OK);
});

Deno.test("POST /api/auth/reset-password rejects an unknown token", async () => {
  await register();

  const response = await resetPassword(
    "not-a-token-anyone-issued",
    newPassword,
  );

  assertEquals(response.status, STATUS_CODE.Gone);
  assertEquals(await response.json(), { error: "The link is no longer valid" });
});

Deno.test("POST /api/auth/reset-password rejects a real id with the wrong secret", async () => {
  await register();
  const token = await requestResetToken();
  const [id] = token.split(".");

  // The id half is public in the sense that it is a uuid in a link; only the secret half
  // proves the link was the one that was mailed.
  const response = await resetPassword(`${id}.${"a".repeat(43)}`, newPassword);

  assertEquals(response.status, STATUS_CODE.Gone);
  assertEquals((await login(password)).status, STATUS_CODE.OK);
});

Deno.test("POST /api/auth/reset-password rejects a malformed token", async () => {
  await register();

  // The id reaches a uuid column, so this must be a miss rather than a database error.
  const response = await resetPassword(
    "not-a-token-anyone-issued",
    newPassword,
  );

  assertEquals(response.status, STATUS_CODE.Gone);
  assertEquals(await response.json(), { error: "The link is no longer valid" });
});
