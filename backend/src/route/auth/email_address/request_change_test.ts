import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import { countMail, deleteAllMail } from "@/src/test/mailpit.ts";
import { postJson } from "@/src/test/auth.ts";
import {
  currentAddress,
  linksFromMail,
  newAddress,
  pendingAddress,
  registerVerified,
  requestChange,
  storedAddress,
  username,
} from "@/src/test/email_change.ts";

Deno.test.beforeEach(async () => {
  await clearRateLimits();
  await deleteAllMail();
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
  assertEquals(await countMail(), 2);
});

Deno.test("POST /api/auth/email-address/change refuses a wrong password", async () => {
  const cookie = await registerVerified();

  const response = await requestChange(cookie, newAddress, "not-the-password");

  // The whole point: a stolen session is not enough to move the account.
  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertEquals(await pendingAddress(), undefined);

  await flushBackgroundWork();
  assertEquals(await countMail(), 0);
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
