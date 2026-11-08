import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { BreachedPasswordService } from "#/src/service/breached_password_service.ts";
import { STATUS_CODE } from "#/src/http/status.ts";
import app from "#/src/app.ts";
import { clearRateLimits, deleteUsers, write } from "#/src/test/support.ts";
import { flushBackgroundWork } from "#/src/util/background.ts";
import { tokenFromMail, waitForMail } from "#/src/test/mailpit.ts";
import { PASSWORD_BREACHED } from "#/src/http/response.ts";
import { authFixture, password, postJson, sessionCookie } from "#/src/test/auth.ts";

// Its own account, so a file running beside this one cannot register or delete it.
const { clearMail, emailAddress, registerAndDiscardVerificationMail, username } =
  authFixture("reset");

beforeEach(async () => {
  await clearRateLimits();
  await clearMail();
});
afterEach(() => deleteUsers([username]));

const newPassword = "an-entirely-different-password";

/** Runs the half of the flow the tests below all need: register, ask, read the link. */
async function requestResetToken(): Promise<string> {
  await postJson("/api/auth/forgot-password", { login: emailAddress });
  await flushBackgroundWork();
  return tokenFromMail(await waitForMail(emailAddress));
}

const resetPassword = (token: string, to: string) =>
  postJson("/api/auth/reset-password", { token, password: to });

const login = (withPassword: string) =>
  postJson("/api/auth/login", { login: username, password: withPassword });

test("POST /api/auth/reset-password replaces the password", async () => {
  await registerAndDiscardVerificationMail();
  const token = await requestResetToken();

  const response = await resetPassword(token, newPassword);
  assert.equal(response.status, STATUS_CODE.OK);
  assert.deepEqual(await response.json(), { ok: true });

  assert.equal((await login(newPassword)).status, STATUS_CODE.OK);
  // The point of the whole flow: whoever knew the old password no longer gets in.
  assert.equal((await login(password)).status, STATUS_CODE.Unauthorized);
});

test("POST /api/auth/reset-password ends every existing session", async () => {
  const cookie = sessionCookie(await registerAndDiscardVerificationMail());

  // The session works before the reset, so the assertion afterwards fails for the right
  // reason rather than because the cookie was never valid.
  assert.equal((await app.request("/api/auth/me", { headers: { cookie } })).status, STATUS_CODE.OK);

  await resetPassword(await requestResetToken(), newPassword);

  assert.equal(
    (await app.request("/api/auth/me", { headers: { cookie } })).status,
    STATUS_CODE.Unauthorized,
  );
});

test("POST /api/auth/reset-password spends the token exactly once", async () => {
  await registerAndDiscardVerificationMail();
  const token = await requestResetToken();

  assert.equal((await resetPassword(token, newPassword)).status, STATUS_CODE.OK);

  const second = await resetPassword(token, "a-third-password");
  assert.equal(second.status, STATUS_CODE.Gone);

  // The second attempt changed nothing, rather than merely reporting an error.
  assert.equal((await login(newPassword)).status, STATUS_CODE.OK);
});

test("POST /api/auth/reset-password rejects an expired token", async () => {
  await registerAndDiscardVerificationMail();
  const token = await requestResetToken();

  await write((transaction) =>
    transaction
      .updateTable("userToken")
      .set({
        expiresAt: Temporal.Now.instant().subtract({ minutes: 1 }).toString(),
      })
      .where("purpose", "=", "password_reset")
      .execute(),
  );

  assert.equal((await resetPassword(token, newPassword)).status, STATUS_CODE.Gone);
  assert.equal((await login(password)).status, STATUS_CODE.OK);
});

test("POST /api/auth/reset-password rejects an unknown token", async () => {
  await registerAndDiscardVerificationMail();

  const response = await resetPassword("not-a-token-anyone-issued", newPassword);

  assert.equal(response.status, STATUS_CODE.Gone);
  assert.deepEqual(await response.json(), {
    error: "The link is no longer valid",
  });
});

test("POST /api/auth/reset-password rejects a real id with the wrong secret", async () => {
  await registerAndDiscardVerificationMail();
  const token = await requestResetToken();
  const [id] = token.split(".");

  // The id half is public in the sense that it is a uuid in a link; only the secret half
  // proves the link was the one that was mailed.
  const response = await resetPassword(`${id}.${"a".repeat(43)}`, newPassword);

  assert.equal(response.status, STATUS_CODE.Gone);
  assert.equal((await login(password)).status, STATUS_CODE.OK);
});

test("POST /api/auth/reset-password rejects a malformed token", async () => {
  await registerAndDiscardVerificationMail();

  // The id reaches a uuid column, so this must be a miss rather than a database error.
  const response = await resetPassword("not-a-token-anyone-issued", newPassword);

  assert.equal(response.status, STATUS_CODE.Gone);
  assert.deepEqual(await response.json(), {
    error: "The link is no longer valid",
  });
});

test("POST /api/auth/reset-password refuses a password from a known breach", async (t) => {
  await registerAndDiscardVerificationMail();
  const token = await requestResetToken();

  const isBreached = t.mock.method(BreachedPasswordService, "isBreached", () =>
    Promise.resolve(true),
  );

  const response = await resetPassword(token, newPassword);

  assert.equal(response.status, STATUS_CODE.UnprocessableEntity);
  assert.equal((await response.json()).code, PASSWORD_BREACHED);
  assert.deepEqual(isBreached.mock.calls[0]?.arguments, [newPassword]);
  isBreached.mock.restore();

  // Refused before the token was spent, so the link still works.
  assert.equal((await resetPassword(token, newPassword)).status, STATUS_CODE.OK);
});
