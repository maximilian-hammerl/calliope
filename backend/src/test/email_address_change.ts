import { db } from "@/src/database/client.ts";
import { registerUser } from "@/src/test/support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import {
  deleteAllMail,
  tokenFromMail,
  waitForMail,
} from "@/src/test/mailpit.ts";
import { sendJson } from "@/src/test/auth.ts";

export const username = "email-change-test-user";
export const password = "a-complex-password";
export const currentAddress = `${username}@example.com`;
export const newAddress = "moved-to@example.com";

export async function registerVerified(): Promise<string> {
  const cookie = await registerUser(username);
  await flushBackgroundWork();
  // Registering sends its own verification mail; a test asserting on messages must not see it.
  await deleteAllMail();
  return cookie;
}

export const requestChange = (
  cookie: string,
  address: string,
  withPassword: string = password,
) =>
  sendJson("POST", "/api/auth/email-address/change", {
    emailAddress: address,
    password: withPassword,
  }, cookie);

export const confirmChange = (token: string) =>
  sendJson("POST", "/api/auth/email-address/confirm", { token });

export const cancelChange = (token: string) =>
  sendJson("POST", "/api/auth/email-address/cancel", { token });

export async function storedAddress(): Promise<string> {
  const user = await db
    .selectFrom("user")
    .select(["emailAddress"])
    .where("username", "=", username)
    .executeTakeFirstOrThrow();
  return user.emailAddress;
}

export async function pendingAddress(): Promise<string | null | undefined> {
  const token = await db
    .selectFrom("userToken")
    .select(["newEmailAddress"])
    .where("purpose", "=", "email_address_change")
    .where("consumedAt", "is", null)
    .executeTakeFirst();
  return token?.newEmailAddress;
}

/** The two links the request sends: one to confirm, one to call it off. */
export async function linksFromMail(): Promise<
  { confirm: string; cancel: string }
> {
  await flushBackgroundWork();
  return {
    confirm: tokenFromMail(await waitForMail(newAddress)),
    cancel: tokenFromMail(await waitForMail(currentAddress)),
  };
}
