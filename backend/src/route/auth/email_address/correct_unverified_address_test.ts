import { assertEquals, assertNotEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { db } from "@/src/database/client.ts";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import { tokenFromMail, waitForMail } from "@/src/test/mailpit.ts";
import {
  authFixture,
  postJson,
  sendJson,
  sessionCookie,
} from "@/src/test/auth.ts";

// Its own account, so a file running beside this one cannot register or delete it.
const { clearMail, emailAddress, register, username } = authFixture(
  "correct-unverified",
  "corrected-address@example.com",
);

Deno.test.beforeEach(async () => {
  await clearRateLimits();
  await clearMail();
});
Deno.test.afterEach(() => deleteUsers([username]));

const corrected = "corrected-address@example.com";

const changeAddress = (cookie: string, address: string) =>
  sendJson(
    "PATCH",
    "/api/auth/email-address",
    { emailAddress: address },
    cookie,
  );

async function storedAddress(): Promise<string> {
  const user = await db
    .selectFrom("user")
    .select(["emailAddress"])
    .where("username", "=", username)
    .executeTakeFirstOrThrow();
  return user.emailAddress;
}

async function markVerified(): Promise<void> {
  await db
    .updateTable("user")
    .set({ emailAddressVerifiedAt: Temporal.Now.instant().toString() })
    .where("username", "=", username)
    .execute();
}

Deno.test("PATCH /api/auth/email-address corrects an address that is not verified", async () => {
  const cookie = sessionCookie(await register());
  await flushBackgroundWork();
  await clearMail();

  const response = await changeAddress(cookie, corrected);

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await storedAddress(), corrected);

  // The new address gets its own link, or correcting a typo would leave nowhere to go.
  await flushBackgroundWork();
  assertEquals((await waitForMail(corrected)).to, corrected);
});

Deno.test("PATCH /api/auth/email-address invalidates the link sent to the old address", async () => {
  const cookie = sessionCookie(await register());
  await flushBackgroundWork();
  const staleToken = tokenFromMail(await waitForMail(emailAddress));
  await clearMail();

  await changeAddress(cookie, corrected);
  await flushBackgroundWork();

  // Whoever received the mistyped mail must not be able to confirm somebody else's account.
  const response = await postJson("/api/auth/verify-email-address", {
    token: staleToken,
  });

  assertEquals(response.status, STATUS_CODE.Gone);
});

Deno.test("PATCH /api/auth/email-address refuses once the address is verified", async () => {
  const cookie = sessionCookie(await register());
  await markVerified();
  await flushBackgroundWork();
  await clearMail();

  const response = await changeAddress(cookie, corrected);

  // A stolen session must not be able to move the account to another inbox: changing a
  // verified address has to notify the old one, which is a separate feature.
  assertEquals(response.status, STATUS_CODE.Forbidden);
  assertEquals(await storedAddress(), emailAddress);
  assertNotEquals(await storedAddress(), corrected);
});

Deno.test("PATCH /api/auth/email-address refuses an address another account uses", async () => {
  const otherUsername = "change-address-other-user";
  await postJson("/api/auth/register", {
    username: otherUsername,
    password: "a-complex-password",
    emailAddress: corrected,
  });

  try {
    const cookie = sessionCookie(await register());
    await flushBackgroundWork();
    await clearMail();

    const response = await changeAddress(cookie, corrected);

    assertEquals(response.status, STATUS_CODE.Conflict);
    assertEquals(await storedAddress(), emailAddress);
  } finally {
    await deleteUsers([otherUsername]);
  }
});
