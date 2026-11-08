import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import { waitForMail } from "@/src/test/mailpit.ts";
import { postJson } from "@/src/test/auth.ts";
import { emailChangeFixture } from "@/src/test/email_address_change.ts";

// Its own account and addresses, so the file next door cannot occupy them.
const {
  clearMail,
  currentAddress,
  linksFromMail,
  mailCount,
  newAddress,
  pendingAddress,
  registerVerified,
  requestChange,
  storedAddress,
  username,
} = emailChangeFixture("request");

beforeEach(async () => {
  await clearRateLimits();
  await clearMail();
});
afterEach(() => deleteUsers([username]));

test("POST /api/auth/email-address/change stages the change without applying it", async () => {
  const cookie = await registerVerified();

  const response = await requestChange(cookie, newAddress);
  assert.equal(response.status, STATUS_CODE.OK);

  // The account still belongs to the old address until the new one is proven.
  assert.equal(await storedAddress(), currentAddress);
  assert.equal(await pendingAddress(), newAddress);
});

test("POST /api/auth/email-address/change writes to both addresses", async () => {
  const cookie = await registerVerified();

  await requestChange(cookie, newAddress);
  await flushBackgroundWork();

  // The notice to the old address is what saves an account whose password has leaked, so its
  // absence would be silent and serious.
  const links = await linksFromMail();
  assert.equal(links.confirm, links.cancel);
  assert.equal(await mailCount(), 2);
});

test("POST /api/auth/email-address/change mails paths the frontend has", async () => {
  const cookie = await registerVerified();

  await requestChange(cookie, newAddress);
  await flushBackgroundWork();

  // Both pointed at `/confirm-email-change` while the router only had
  // `/confirm-email-address-change`, so every link opened a blank page and nothing failed.
  // The frontend pins the same two paths in `router/__tests__/mailedPaths.spec.ts`.
  assert.ok((await waitForMail(newAddress)).text.includes("/confirm-email-address-change?token="));
  assert.ok(
    (await waitForMail(currentAddress)).text.includes("/cancel-email-address-change?token="),
  );
});

test("POST /api/auth/email-address/change refuses a wrong password", async () => {
  const cookie = await registerVerified();

  const response = await requestChange(cookie, newAddress, "not-the-password");

  // The whole point: a stolen session is not enough to move the account.
  assert.equal(response.status, STATUS_CODE.Unauthorized);
  // The frontend tells a wrong password from a lost session by this code, not the message.
  assert.equal((await response.json()).code, "invalid_credentials");
  assert.equal(await pendingAddress(), undefined);

  await flushBackgroundWork();
  assert.equal(await mailCount(), 0);
});

test("POST /api/auth/email-address/change refuses an address in use", async () => {
  const otherUsername = "email-change-other-user";
  await postJson("/api/auth/register", {
    username: otherUsername,
    password: "a-complex-password",
    emailAddress: newAddress,
  });

  try {
    const cookie = await registerVerified();

    const response = await requestChange(cookie, newAddress);

    assert.equal(response.status, STATUS_CODE.Conflict);
    assert.equal(await pendingAddress(), undefined);
  } finally {
    await deleteUsers([otherUsername]);
  }
});

test("POST /api/auth/email-address/change needs a session", async () => {
  const response = await postJson("/api/auth/email-address/change", {
    emailAddress: newAddress,
    password: "a-complex-password",
  });

  assert.equal(response.status, STATUS_CODE.Unauthorized);
});
