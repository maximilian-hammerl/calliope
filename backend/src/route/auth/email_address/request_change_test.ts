import { assertEquals, assertStringIncludes } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
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

Deno.test.beforeEach(async () => {
  await clearRateLimits();
  await clearMail();
});
Deno.test.afterEach(() => deleteUsers([username]));

Deno.test("POST /api/auth/email-address/change stages the change without applying it", async () => {
  const cookie = await registerVerified();

  const response = await requestChange(cookie, newAddress);
  assertEquals(response.status, STATUS_CODE.OK);

  // The account still belongs to the old address until the new one is proven.
  assertEquals(await storedAddress(), currentAddress);
  assertEquals(await pendingAddress(), newAddress);
});

Deno.test("POST /api/auth/email-address/change writes to both addresses", async () => {
  const cookie = await registerVerified();

  await requestChange(cookie, newAddress);
  await flushBackgroundWork();

  // The notice to the old address is what saves an account whose password has leaked, so its
  // absence would be silent and serious.
  const links = await linksFromMail();
  assertEquals(links.confirm, links.cancel);
  assertEquals(await mailCount(), 2);
});

Deno.test("POST /api/auth/email-address/change mails paths the frontend has", async () => {
  const cookie = await registerVerified();

  await requestChange(cookie, newAddress);
  await flushBackgroundWork();

  // Both pointed at `/confirm-email-change` while the router only had
  // `/confirm-email-address-change`, so every link opened a blank page and nothing failed.
  // The frontend pins the same two paths in `router/__tests__/mailedPaths.spec.ts`.
  assertStringIncludes(
    (await waitForMail(newAddress)).text,
    "/confirm-email-address-change?token=",
  );
  assertStringIncludes(
    (await waitForMail(currentAddress)).text,
    "/cancel-email-address-change?token=",
  );
});

Deno.test("POST /api/auth/email-address/change refuses a wrong password", async () => {
  const cookie = await registerVerified();

  const response = await requestChange(cookie, newAddress, "not-the-password");

  // The whole point: a stolen session is not enough to move the account.
  assertEquals(response.status, STATUS_CODE.Unauthorized);
  // The frontend tells a wrong password from a lost session by this code, not the message.
  assertEquals((await response.json()).code, "invalid_credentials");
  assertEquals(await pendingAddress(), undefined);

  await flushBackgroundWork();
  assertEquals(await mailCount(), 0);
});

Deno.test("POST /api/auth/email-address/change refuses an address in use", async () => {
  const otherUsername = "email-change-other-user";
  await postJson("/api/auth/register", {
    username: otherUsername,
    password: "a-complex-password",
    emailAddress: newAddress,
  });

  try {
    const cookie = await registerVerified();

    const response = await requestChange(cookie, newAddress);

    assertEquals(response.status, STATUS_CODE.Conflict);
    assertEquals(await pendingAddress(), undefined);
  } finally {
    await deleteUsers([otherUsername]);
  }
});

Deno.test("POST /api/auth/email-address/change needs a session", async () => {
  const response = await postJson("/api/auth/email-address/change", {
    emailAddress: newAddress,
    password: "a-complex-password",
  });

  assertEquals(response.status, STATUS_CODE.Unauthorized);
});
