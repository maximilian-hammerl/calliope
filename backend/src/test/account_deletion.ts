import { db } from "@/src/database/client.ts";
import { registerUser } from "@/src/test/support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import {
  countMailFor,
  deleteMailFor,
  tokenFromMail,
  waitForMail,
} from "@/src/test/mailpit.ts";
import { sendJson } from "@/src/test/auth.ts";

export const password = "a-complex-password";

/**
 * One fixture per test file, named by `scope`. Shared module-level constants made the two
 * files that exercise this flow register the same account and clear each other's mail.
 */
export function accountDeletionFixture(scope: string) {
  const username = `account-deletion-${scope}-user`;
  const emailAddress = `${username}@example.com`;
  const clearMail = () => deleteMailFor([emailAddress]);
  const mailCount = () => countMailFor([emailAddress]);

  async function registerDeletable(): Promise<string> {
    const cookie = await registerUser(username);
    await flushBackgroundWork();
    // Registering sends its own verification mail; a test asserting on messages must not see it.
    await clearMail();
    return cookie;
  }

  /** Leaves the address unverified, which `registerUser` otherwise confirms for convenience. */
  async function registerUnverified(): Promise<string> {
    const cookie = await registerUser(username);
    await db
      .updateTable("user")
      .set({ emailAddressVerifiedAt: null })
      .where("username", "=", username)
      .execute();
    await flushBackgroundWork();
    await clearMail();
    return cookie;
  }

  const requestDeletion = (
    cookie: string,
    withPassword: string = password,
  ) =>
    sendJson("POST", "/api/auth/account/deletion", {
      password: withPassword,
    }, cookie);

  const confirmDeletion = (token: string) =>
    sendJson("POST", "/api/auth/account/deletion/confirm", { token });

  /** The token only exists in plaintext in the message, so the flow has to go through the mail. */
  async function deletionToken(): Promise<string> {
    await flushBackgroundWork();
    return tokenFromMail(await waitForMail(emailAddress));
  }

  async function accountExists(): Promise<boolean> {
    const user = await db
      .selectFrom("user")
      .select("id")
      .where("username", "=", username)
      .executeTakeFirst();

    return user !== undefined;
  }

  async function outstandingTokens(): Promise<number> {
    const rows = await db
      .selectFrom("userToken")
      .innerJoin("user", "user.id", "userToken.userId")
      .select("userToken.id")
      .where("user.username", "=", username)
      .where("userToken.purpose", "=", "account_deletion")
      .where("userToken.consumedAt", "is", null)
      .execute();

    return rows.length;
  }

  async function sessionCount(): Promise<number> {
    const rows = await db
      .selectFrom("userSession")
      .innerJoin("user", "user.id", "userSession.userId")
      .select("userSession.id")
      .where("user.username", "=", username)
      .execute();

    return rows.length;
  }

  return {
    username,
    emailAddress,
    clearMail,
    mailCount,
    registerDeletable,
    registerUnverified,
    requestDeletion,
    confirmDeletion,
    deletionToken,
    accountExists,
    outstandingTokens,
    sessionCount,
  };
}
