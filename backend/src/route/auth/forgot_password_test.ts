import { assertEquals, assertStringIncludes } from "@std/assert";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { STATUS_CODE } from "@std/http/status";
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

Deno.test.beforeEach(async () => {
  await clearRateLimits();
  await clearMail();
});
Deno.test.afterEach(() => deleteUsers([username]));

const forgotPassword = (login: string) =>
  postJson("/api/auth/forgot-password", { login });

Deno.test("POST /api/auth/forgot-password mails a link to a registered address", async () => {
  await registerAndDiscardVerificationMail();

  const response = await forgotPassword(emailAddress);
  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { ok: true });

  await flushBackgroundWork();
  const mail = await waitForMail(emailAddress);

  assertStringIncludes(mail.subject, "Calliope");
  assertStringIncludes(mail.text, username);
  // The link has to point at the frontend route that spends the token, not at the API.
  assertStringIncludes(
    mail.text,
    `${getRequiredEnvVariable("HOST_URL")}/reset-password?token=`,
  );
});

Deno.test("POST /api/auth/forgot-password answers the same way for an unknown address", async () => {
  await registerAndDiscardVerificationMail();

  const response = await forgotPassword("nobody-has-this@example.com");

  // Byte-for-byte the response a registered address gets: anything else would say whether
  // the address is in use.
  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { ok: true });

  await flushBackgroundWork();
  assertEquals(await mailCount(), 0);
});

Deno.test("POST /api/auth/forgot-password matches the address in any case", async () => {
  await registerAndDiscardVerificationMail();

  const response = await forgotPassword(emailAddress.toUpperCase());
  assertEquals(response.status, STATUS_CODE.OK);

  await flushBackgroundWork();
  assertEquals((await waitForMail(emailAddress)).to, emailAddress);
});

Deno.test("POST /api/auth/forgot-password also takes the username", async () => {
  await registerAndDiscardVerificationMail();

  // Whoever cannot sign in may not remember which of the two they registered with; the mail
  // still goes to the address on the account either way.
  const response = await forgotPassword(username);
  assertEquals(response.status, STATUS_CODE.OK);

  await flushBackgroundWork();
  assertEquals((await waitForMail(emailAddress)).to, emailAddress);
});

Deno.test("POST /api/auth/forgot-password sends only one link within the cooldown", async () => {
  await registerAndDiscardVerificationMail();

  await forgotPassword(emailAddress);
  await flushBackgroundWork();
  await waitForMail(emailAddress);

  const second = await forgotPassword(emailAddress);
  assertEquals(second.status, STATUS_CODE.OK);

  await flushBackgroundWork();
  // Without the cooldown, repeating this request is a way to fill somebody else's inbox.
  assertEquals(await mailCount(), 1);
});
