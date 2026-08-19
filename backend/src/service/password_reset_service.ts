import { db } from "@/src/database/client.ts";
import { hashPassword } from "@/src/util/password.ts";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { runInBackground } from "@/src/util/background.ts";
import { Mailer } from "@/src/mail/mailer.ts";
import { passwordResetMail } from "@/src/mail/password_reset_mail.ts";
import {
  TOKEN_LIFETIME,
  UserTokenService,
} from "@/src/service/user_token_service.ts";

const HOST_URL = getRequiredEnvVariable("HOST_URL");

function resetLink(token: string): string {
  const url = new URL("/reset-password", HOST_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

/**
 * Answers nothing in every case, including when nobody has this login. All of the work runs
 * in the background, so the request path is the same for an account that exists and one that
 * does not — otherwise the *time* still answers the question the response refuses to.
 */
function requestPasswordReset(usernameOrEmailAddress: string): void {
  runInBackground(
    "Issuing a password reset link",
    () => issuePasswordReset(usernameOrEmailAddress),
  );
}

async function issuePasswordReset(
  usernameOrEmailAddress: string,
): Promise<void> {
  const user = await db
    .selectFrom("user")
    .select(["id", "username", "emailAddress"])
    // Both identifiers, as the login route accepts. Addresses are stored lower-cased by the
    // register route, so the comparison has to match that.
    //
    // An unverified address is deliberately not excluded: the mail goes where the member
    // already asked for mail to go, and refusing would add a lockout with nothing gained.
    .where((eb) =>
      eb.or([
        eb("username", "=", usernameOrEmailAddress),
        eb("emailAddress", "=", usernameOrEmailAddress.toLowerCase()),
      ])
    )
    .executeTakeFirst();

  if (user === undefined) {
    return;
  }

  const token = await UserTokenService.issueToken({
    userId: user.id,
    purpose: "password_reset",
  });

  if (token === undefined) {
    return;
  }

  Mailer.sendInBackground(passwordResetMail({
    username: user.username,
    emailAddress: user.emailAddress,
    link: resetLink(token),
    lifetime: TOKEN_LIFETIME,
  }));
}

export type PasswordResetResult = "reset" | "invalid_token";

/**
 * Consuming the token, setting the password and ending every session happen in one
 * transaction: a half-applied reset would either leave the old password working or leave the
 * member unable to use the link again.
 */
async function resetPassword(
  token: string,
  password: string,
): Promise<PasswordResetResult> {
  const hashedPassword = await hashPassword(password);

  return await db.transaction().execute(async (transaction) => {
    const consumed = await UserTokenService.consumeToken(
      transaction,
      token,
      "password_reset",
    );

    if (consumed === undefined) {
      return "invalid_token";
    }

    await transaction
      .updateTable("user")
      .set({ hashedPassword })
      .where("id", "=", consumed.userId)
      .execute();

    // Whoever asked for this could not sign in, which is a fair sign the account may have
    // been someone else's. Every existing session goes, including any the attacker holds.
    await transaction
      .deleteFrom("userSession")
      .where("userId", "=", consumed.userId)
      .execute();

    return "reset";
  });
}

export const PasswordResetService = {
  requestPasswordReset,
  resetPassword,
};
