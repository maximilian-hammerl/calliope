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
 * One fixture per test file, named by `scope`. These constants used to be module-level, so
 * both files that exercise the flow registered the same account and both occupied the same
 * new address — each becoming the other's "address already in use".
 */
export function emailChangeFixture(scope: string) {
  const username = `email-change-${scope}-user`;
  const currentAddress = `${username}@example.com`;
  const newAddress = `email-change-${scope}-moved@example.com`;
  const addresses = [currentAddress, newAddress];

  /** Only this fixture's mail, so the file next door keeps what it is waiting for. */
  const clearMail = () => deleteMailFor(addresses);
  const mailCount = () => countMailFor(addresses);

  async function registerVerified(): Promise<string> {
    const cookie = await registerUser(username);
    await flushBackgroundWork();
    // Registering sends its own verification mail; a test asserting on messages must not see it.
    await clearMail();
    return cookie;
  }

  const requestChange = (
    cookie: string,
    address: string,
    withPassword: string = password,
  ) =>
    sendJson("POST", "/api/auth/email-address/change", {
      emailAddress: address,
      password: withPassword,
    }, cookie);

  const confirmChange = (token: string) =>
    sendJson("POST", "/api/auth/email-address/confirm", { token });

  const cancelChange = (token: string) =>
    sendJson("POST", "/api/auth/email-address/cancel", { token });

  async function storedAddress(): Promise<string> {
    const user = await db
      .selectFrom("user")
      .select(["emailAddress"])
      .where("username", "=", username)
      .executeTakeFirstOrThrow();
    return user.emailAddress;
  }

  /** Scoped to this fixture's account: unscoped, it returned whoever's token came first. */
  async function pendingAddress(): Promise<string | null | undefined> {
    const token = await db
      .selectFrom("userToken")
      .innerJoin("user", "user.id", "userToken.userId")
      .select(["userToken.newEmailAddress"])
      .where("userToken.purpose", "=", "email_address_change")
      .where("userToken.consumedAt", "is", null)
      .where("user.username", "=", username)
      .executeTakeFirst();
    return token?.newEmailAddress;
  }

  /** The two links the request sends: one to confirm, one to call it off. */
  async function linksFromMail(): Promise<
    { confirm: string; cancel: string }
  > {
    await flushBackgroundWork();
    return {
      confirm: tokenFromMail(await waitForMail(newAddress)),
      cancel: tokenFromMail(await waitForMail(currentAddress)),
    };
  }

  return {
    username,
    currentAddress,
    newAddress,
    clearMail,
    mailCount,
    registerVerified,
    requestChange,
    confirmChange,
    cancelChange,
    storedAddress,
    pendingAddress,
    linksFromMail,
  };
}
