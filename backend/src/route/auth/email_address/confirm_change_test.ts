import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
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

Deno.test.beforeEach(async () => {
  await clearRateLimits();
  await clearMail();
});
Deno.test.afterEach(() => deleteUsers([username]));

async function stageChange(): Promise<{ cookie: string; token: string }> {
  const cookie = await registerVerified();
  await requestChange(cookie, newAddress);
  return { cookie, token: (await linksFromMail()).confirm };
}

Deno.test("POST /api/auth/email-address/confirm moves the account", async () => {
  const { token } = await stageChange();

  assertEquals((await confirmChange(token)).status, STATUS_CODE.OK);
  assertEquals(await storedAddress(), newAddress);

  // Signing in with the new address proves it is the account's, not just a stored string.
  const login = await postJson("/api/auth/login", {
    login: newAddress,
    password: "a-complex-password",
  });
  assertEquals(login.status, STATUS_CODE.OK);
});

Deno.test("POST /api/auth/email-address/confirm ends every session", async () => {
  const { cookie, token } = await stageChange();

  assertEquals(
    (await app.request("/api/auth/me", { headers: { cookie } })).status,
    STATUS_CODE.OK,
  );

  await confirmChange(token);

  assertEquals(
    (await app.request("/api/auth/me", { headers: { cookie } })).status,
    STATUS_CODE.Unauthorized,
  );
});

Deno.test("POST /api/auth/email-address/confirm tells the old address afterwards", async () => {
  const { token } = await stageChange();
  await clearMail();

  await confirmChange(token);
  await flushBackgroundWork();

  const notice = await waitForMail(currentAddress);
  assertEquals(notice.to, currentAddress);
});

Deno.test("POST /api/auth/email-address/confirm spends the link once", async () => {
  const { token } = await stageChange();

  assertEquals((await confirmChange(token)).status, STATUS_CODE.OK);
  assertEquals((await confirmChange(token)).status, STATUS_CODE.Gone);
});

Deno.test("POST /api/auth/email-address/confirm keeps the old address when the new one was taken meanwhile", async () => {
  const { token } = await stageChange();

  const otherUsername = "confirm-change-other-user";
  await postJson("/api/auth/register", {
    username: otherUsername,
    password: "a-complex-password",
    emailAddress: newAddress,
  });

  try {
    // The link stayed valid for an hour, and somebody registered the address inside it.
    assertEquals((await confirmChange(token)).status, STATUS_CODE.Conflict);
    assertEquals(await storedAddress(), currentAddress);
  } finally {
    await deleteUsers([otherUsername]);
  }
});

Deno.test("a cancelled change can no longer be confirmed", async () => {
  const { token } = await stageChange();

  assertEquals((await cancelChange(token)).status, STATUS_CODE.OK);
  assertEquals((await confirmChange(token)).status, STATUS_CODE.Gone);
  assertEquals(await storedAddress(), currentAddress);
});

Deno.test("cancelling twice reports the second as gone", async () => {
  const { token } = await stageChange();

  assertEquals((await cancelChange(token)).status, STATUS_CODE.OK);
  assertEquals((await cancelChange(token)).status, STATUS_CODE.Gone);
});
