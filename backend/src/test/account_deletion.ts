import { db } from "@/src/database/client.ts";
import { registerUser } from "@/src/test/support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import {
  deleteAllMail,
  tokenFromMail,
  waitForMail,
} from "@/src/test/mailpit.ts";
import { sendJson } from "@/src/test/auth.ts";

export const username = "account-deletion-test-user";
export const password = "a-complex-password";
export const emailAddress = `${username}@example.com`;

export async function registerDeletable(): Promise<string> {
  const cookie = await registerUser(username);
  await flushBackgroundWork();
  // Registering sends its own verification mail; a test asserting on messages must not see it.
  await deleteAllMail();
  return cookie;
}

export const requestDeletion = (
  cookie: string,
  withPassword: string = password,
) =>
  sendJson("POST", "/api/auth/account/deletion", {
    password: withPassword,
  }, cookie);

export const confirmDeletion = (token: string) =>
  sendJson("POST", "/api/auth/account/deletion/confirm", { token });

/** The token only exists in plaintext in the message, so the flow has to go through the mail. */
export async function deletionToken(): Promise<string> {
  await flushBackgroundWork();
  return tokenFromMail(await waitForMail(emailAddress));
}

export async function accountExists(): Promise<boolean> {
  const user = await db
    .selectFrom("user")
    .select("id")
    .where("username", "=", username)
    .executeTakeFirst();

  return user !== undefined;
}

export async function outstandingTokens(): Promise<number> {
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

export async function sessionCount(): Promise<number> {
  const rows = await db
    .selectFrom("userSession")
    .innerJoin("user", "user.id", "userSession.userId")
    .select("userSession.id")
    .where("user.username", "=", username)
    .execute();

  return rows.length;
}
