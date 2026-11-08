import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import app from "@/src/app.ts";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import { waitForMail } from "@/src/test/mailpit.ts";
import { postJson } from "@/src/test/auth.ts";
import { emailChangeFixture } from "@/src/test/email_address_change.ts";

// Its own account and addresses, so the file next door cannot occupy them.
const {
  cancelChange,
  clearMail,
  confirmChange,
  currentAddress,
  linksFromMail,
  newAddress,
  registerVerified,
  requestChange,
  storedAddress,
  username,
} = emailChangeFixture("confirm");

beforeEach(async () => {
  await clearRateLimits();
  await clearMail();
});
afterEach(() => deleteUsers([username]));

async function stageChange(): Promise<{ cookie: string; token: string }> {
  const cookie = await registerVerified();
  await requestChange(cookie, newAddress);
  return { cookie, token: (await linksFromMail()).confirm };
}

test("POST /api/auth/email-address/confirm moves the account", async () => {
  const { token } = await stageChange();

  assert.equal((await confirmChange(token)).status, STATUS_CODE.OK);
  assert.equal(await storedAddress(), newAddress);

  // Signing in with the new address proves it is the account's, not just a stored string.
  const login = await postJson("/api/auth/login", {
    login: newAddress,
    password: "a-complex-password",
  });
  assert.equal(login.status, STATUS_CODE.OK);
});

test("POST /api/auth/email-address/confirm ends every session", async () => {
  const { cookie, token } = await stageChange();

  assert.equal((await app.request("/api/auth/me", { headers: { cookie } })).status, STATUS_CODE.OK);

  await confirmChange(token);

  assert.equal(
    (await app.request("/api/auth/me", { headers: { cookie } })).status,
    STATUS_CODE.Unauthorized,
  );
});

test("POST /api/auth/email-address/confirm tells the old address afterwards", async () => {
  const { token } = await stageChange();
  await clearMail();

  await confirmChange(token);
  await flushBackgroundWork();

  const notice = await waitForMail(currentAddress);
  assert.equal(notice.to, currentAddress);
});

test("POST /api/auth/email-address/confirm spends the link once", async () => {
  const { token } = await stageChange();

  assert.equal((await confirmChange(token)).status, STATUS_CODE.OK);
  assert.equal((await confirmChange(token)).status, STATUS_CODE.Gone);
});

test("POST /api/auth/email-address/confirm keeps the old address when the new one was taken meanwhile", async () => {
  const { token } = await stageChange();

  const otherUsername = "confirm-change-other-user";
  await postJson("/api/auth/register", {
    username: otherUsername,
    password: "a-complex-password",
    emailAddress: newAddress,
  });

  try {
    // The link stayed valid for an hour, and somebody registered the address inside it.
    assert.equal((await confirmChange(token)).status, STATUS_CODE.Conflict);
    assert.equal(await storedAddress(), currentAddress);
  } finally {
    await deleteUsers([otherUsername]);
  }
});

test("a cancelled change can no longer be confirmed", async () => {
  const { token } = await stageChange();

  assert.equal((await cancelChange(token)).status, STATUS_CODE.OK);
  assert.equal((await confirmChange(token)).status, STATUS_CODE.Gone);
  assert.equal(await storedAddress(), currentAddress);
});

test("cancelling twice reports the second as gone", async () => {
  const { token } = await stageChange();

  assert.equal((await cancelChange(token)).status, STATUS_CODE.OK);
  assert.equal((await cancelChange(token)).status, STATUS_CODE.Gone);
});
