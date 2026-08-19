import { db } from "@/src/database/client.ts";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { runInBackground } from "@/src/util/background.ts";
import { Mailer } from "@/src/mail/mailer.ts";
import { emailVerificationMail } from "@/src/mail/email_verification_mail.ts";
import {
  TOKEN_LIFETIME,
  UserTokenService,
} from "@/src/service/user_token_service.ts";

const HOST_URL = getRequiredEnvVariable("HOST_URL");

function verificationLink(token: string): string {
  const url = new URL("/verify-email", HOST_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

/** Never awaited: registering must not fail because a mail server was slow or unreachable. */
function sendVerificationMail(
  user: { id: string; username: string; emailAddress: string },
): void {
  runInBackground(
    "Issuing an email verification link",
    async () => {
      const token = await UserTokenService.issueToken(
        user.id,
        "email_verification",
      );

      // The cooldown swallowed it, which means one is already on its way.
      if (token === undefined) {
        return;
      }

      Mailer.sendInBackground(emailVerificationMail({
        username: user.username,
        emailAddress: user.emailAddress,
        link: verificationLink(token),
        lifetime: TOKEN_LIFETIME,
      }));
    },
  );
}

export type VerifyEmailResult = "verified" | "invalid_token";

/**
 * Consuming the token and marking the address verified happen in one transaction, so a link
 * cannot be spent without the account actually changing state.
 *
 * No session is started: the link may well be opened in a browser that is not the member's.
 */
async function verifyEmail(token: string): Promise<VerifyEmailResult> {
  return await db.transaction().execute(async (transaction) => {
    const userId = await UserTokenService.consumeToken(
      transaction,
      token,
      "email_verification",
    );

    if (userId === undefined) {
      return "invalid_token";
    }

    await transaction
      .updateTable("user")
      .set({ emailVerifiedAt: Temporal.Now.instant().toString() })
      // Already verified is not an error, but it must not move the timestamp: that would
      // rewrite when the address was actually proven.
      .where("id", "=", userId)
      .where("emailVerifiedAt", "is", null)
      .execute();

    return "verified";
  });
}

export type ChangeEmailAddressResult =
  | "changed"
  | "already_verified"
  | "in_use";

/**
 * Corrects a mistyped address before it has ever been verified — the escape hatch that keeps
 * a typo at registration from orphaning an account.
 *
 * **This must never touch a verified address.** Changing one is a different feature that has
 * to tell the old address and offer an undo, because an attacker holding a session could
 * otherwise move the account to their own inbox and lock the owner out. Three things enforce
 * that, and the last one is the real guarantee: the caller checks, this function checks, and
 * the UPDATE itself carries `emailVerifiedAt IS NULL`, so no reachable path can change an
 * address that has been proven.
 */
async function changeUnverifiedEmailAddress(
  userId: string,
  emailAddress: string,
): Promise<ChangeEmailAddressResult> {
  const normalisedAddress = emailAddress.toLowerCase();

  const outcome = await db.transaction().execute(async (transaction) => {
    const user = await transaction
      .selectFrom("user")
      .select(["emailVerifiedAt"])
      .where("id", "=", userId)
      .executeTakeFirst();

    if (user === undefined || user.emailVerifiedAt !== null) {
      return "already_verified" as const;
    }

    const taken = await transaction
      .selectFrom("user")
      .select(["id"])
      .where("emailAddress", "=", normalisedAddress)
      .where("id", "!=", userId)
      .executeTakeFirst();

    if (taken !== undefined) {
      return "in_use" as const;
    }

    const updated = await transaction
      .updateTable("user")
      .set({ emailAddress: normalisedAddress })
      .where("id", "=", userId)
      .where("emailVerifiedAt", "is", null)
      .returning(["id", "username", "emailAddress"])
      .executeTakeFirst();

    if (updated === undefined) {
      return "already_verified" as const;
    }

    // The link that went to the old address must stop working, or a typo that happened to be
    // somebody else's real inbox would still let them verify this account.
    await transaction
      .deleteFrom("userToken")
      .where("userId", "=", userId)
      .where("purpose", "=", "email_verification")
      .where("consumedAt", "is", null)
      .execute();

    return updated;
  });

  if (outcome === "already_verified" || outcome === "in_use") {
    return outcome;
  }

  sendVerificationMail(outcome);
  return "changed";
}

export const EmailVerificationService = {
  sendVerificationMail,
  verifyEmail,
  changeUnverifiedEmailAddress,
};
