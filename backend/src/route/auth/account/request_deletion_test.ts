import { assertEquals, assertStringIncludes } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import { waitForMail } from "@/src/test/mailpit.ts";
import { postJson } from "@/src/test/auth.ts";
import { accountDeletionFixture } from "@/src/test/account_deletion.ts";

// Its own account and mailbox, so the file next door cannot clear them.
const {
  accountExists,
  clearMail,
  emailAddress,
  mailCount,
  outstandingTokens,
  registerDeletable,
  registerUnverified,
  requestDeletion,
  username,
} = accountDeletionFixture("request");

Deno.test.beforeEach(async () => {
  await clearRateLimits();
  await clearMail();
});
Deno.test.afterEach(() => deleteUsers([username]));

Deno.test("POST /api/auth/account/deletion deletes nothing yet", async () => {
  const cookie = await registerDeletable();

  const response = await requestDeletion(cookie);
  assertEquals(response.status, STATUS_CODE.OK);

  // The whole shape of the feature: asking is not deleting.
  assertEquals(await accountExists(), true);
  assertEquals(await outstandingTokens(), 1);
});

Deno.test("POST /api/auth/account/deletion mails a link to the address on file", async () => {
  const cookie = await registerDeletable();

  await requestDeletion(cookie);
  await flushBackgroundWork();

  const mail = await waitForMail(emailAddress);
  assertEquals(await mailCount(), 1);
  // The path has to be one the frontend router actually has, or the link opens a blank page.
  assertStringIncludes(mail.text, "/confirm-account-deletion?token=");
});

Deno.test("POST /api/auth/account/deletion refuses a wrong password", async () => {
  const cookie = await registerDeletable();

  const response = await requestDeletion(cookie, "not-the-password");

  // A stolen session must not be able to end the account on its own.
  assertEquals(response.status, STATUS_CODE.Unauthorized);
  // The frontend tells a wrong password from a lost session by this code, not the message.
  assertEquals((await response.json()).code, "invalid_credentials");
  assertEquals(await outstandingTokens(), 0);
  assertEquals(await accountExists(), true);

  await flushBackgroundWork();
  assertEquals(await mailCount(), 0);
});

Deno.test("POST /api/auth/account/deletion works with an unverified address", async () => {
  const cookie = await registerUnverified();

  // The one route a member needs in order to leave without ever verifying. Behind the strict
  // middleware this answered 403, which left somebody who mistyped their address at
  // registration unable either to verify or to go.
  const response = await requestDeletion(cookie);

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await outstandingTokens(), 1);
});

Deno.test("POST /api/auth/account/deletion needs a session", async () => {
  await registerDeletable();

  const response = await postJson("/api/auth/account/deletion", {
    password: "a-complex-password",
  });

  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertEquals(await outstandingTokens(), 0);
});

Deno.test("POST /api/auth/account/deletion sends nothing on a repeat within the cooldown", async () => {
  const cookie = await registerDeletable();

  await requestDeletion(cookie);
  const second = await requestDeletion(cookie);

  // Answered the same way, so the response cannot report on somebody else's inbox.
  assertEquals(second.status, STATUS_CODE.OK);
  await flushBackgroundWork();
  assertEquals(await mailCount(), 1);
  assertEquals(await outstandingTokens(), 1);
});
