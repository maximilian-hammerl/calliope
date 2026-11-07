import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { STATUS_CODE } from "@/src/http/status.ts";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import { waitForMail } from "@/src/test/mailpit.ts";
import { authFixture, postJson } from "@/src/test/auth.ts";

// Its own account, so a file running beside this one cannot register or delete it.
const {
  clearMail,
  emailAddress,
  mailCount,
  registerAndDiscardVerificationMail,
  username,
} = authFixture("forgot");

beforeEach(async () => {
  await clearRateLimits();
  await clearMail();
});
afterEach(() => deleteUsers([username]));

const forgotPassword = (login: string) =>
  postJson("/api/auth/forgot-password", { login });

test("POST /api/auth/forgot-password mails a link to a registered address", async () => {
  await registerAndDiscardVerificationMail();

  const response = await forgotPassword(emailAddress);
  assert.equal(response.status, STATUS_CODE.OK);
  assert.deepEqual(await response.json(), { ok: true });

  await flushBackgroundWork();
  const mail = await waitForMail(emailAddress);

  assert.ok(mail.subject.includes("Calliope"));
  assert.ok(mail.text.includes(username));
  // The link has to point at the frontend route that spends the token, not at the API.
  assert.ok(
    mail.text.includes(
      `${getRequiredEnvVariable("HOST_URL")}/reset-password?token=`,
    ),
  );
});

test("POST /api/auth/forgot-password answers the same way for an unknown address", async () => {
  await registerAndDiscardVerificationMail();

  const response = await forgotPassword("nobody-has-this@example.com");

  // Byte-for-byte the response a registered address gets: anything else would say whether
  // the address is in use.
  assert.equal(response.status, STATUS_CODE.OK);
  assert.deepEqual(await response.json(), { ok: true });

  await flushBackgroundWork();
  assert.equal(await mailCount(), 0);
});

test("POST /api/auth/forgot-password matches the address in any case", async () => {
  await registerAndDiscardVerificationMail();

  const response = await forgotPassword(emailAddress.toUpperCase());
  assert.equal(response.status, STATUS_CODE.OK);

  await flushBackgroundWork();
  assert.equal((await waitForMail(emailAddress)).to, emailAddress);
});

test("POST /api/auth/forgot-password also takes the username", async () => {
  await registerAndDiscardVerificationMail();

  // Whoever cannot sign in may not remember which of the two they registered with; the mail
  // still goes to the address on the account either way.
  const response = await forgotPassword(username);
  assert.equal(response.status, STATUS_CODE.OK);

  await flushBackgroundWork();
  assert.equal((await waitForMail(emailAddress)).to, emailAddress);
});

test("POST /api/auth/forgot-password sends only one link within the cooldown", async () => {
  await registerAndDiscardVerificationMail();

  await forgotPassword(emailAddress);
  await flushBackgroundWork();
  await waitForMail(emailAddress);

  const second = await forgotPassword(emailAddress);
  assert.equal(second.status, STATUS_CODE.OK);

  await flushBackgroundWork();
  // Without the cooldown, repeating this request is a way to fill somebody else's inbox.
  assert.equal(await mailCount(), 1);
});
