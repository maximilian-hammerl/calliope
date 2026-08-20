import { db } from "@/src/database/client.ts";
import { verifyPassword } from "@/src/util/password.ts";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { Mailer } from "@/src/mail/mailer.ts";
import {
  accountDeletionCompletedMail,
  accountDeletionConfirmationMail,
} from "@/src/mail/account_deletion_mail.ts";
import {
  TOKEN_LIFETIME,
  UserTokenService,
} from "@/src/service/user_token_service.ts";

const HOST_URL = getRequiredEnvVariable("HOST_URL");

function link(path: string, token: string): string {
  const url = new URL(path, HOST_URL);
  url.searchParams.set("token", token);
  return url.toString();
}

export type RequestAccountDeletionResult = "requested" | "wrong_password";

/**
 * Asks; does not delete. The password re-authenticates and the mailed link confirms, so
 * neither a stolen session nor a leaked password is enough on its own.
 *
 * No verified address is required, unlike changing one — which is why the route uses the
 * permissive middleware. Somebody who mistyped their address at registration must still be
 * able to leave, and a link that reaches the wrong inbox can only delete the account that was
 * registered to it.
 */
async function requestAccountDeletion(
  userId: string,
  password: string,
): Promise<RequestAccountDeletionResult> {
  const user = await db
    .selectFrom("user")
    .select(["username", "emailAddress", "hashedPassword"])
    .where("id", "=", userId)
    .executeTakeFirstOrThrow();

  if (!await verifyPassword(password, user.hashedPassword)) {
    return "wrong_password";
  }

  const token = await UserTokenService.issueToken({
    userId,
    purpose: "account_deletion",
  });

  // The cooldown swallowed it, so a link is already on its way.
  if (token === undefined) {
    return "requested";
  }

  Mailer.sendInBackground(accountDeletionConfirmationMail({
    username: user.username,
    emailAddress: user.emailAddress,
    link: link("/confirm-account-deletion", token),
    lifetime: TOKEN_LIFETIME,
  }));

  return "requested";
}

export type ConfirmAccountDeletionResult = "deleted" | "invalid_token";

/**
 * Deletes the account. One statement does nearly all of it: the foreign keys cascade sessions,
 * tokens, memberships and notifications, set `created_by` to null wherever text survives, and
 * the triggers on the membership tables drop any group left with nobody in it.
 *
 * The name and address are read first, because after the delete there is nothing left to
 * address the final mail to.
 */
async function confirmAccountDeletion(
  token: string,
): Promise<ConfirmAccountDeletionResult> {
  const deleted = await db.transaction().execute(async (transaction) => {
    const consumed = await UserTokenService.consumeToken(
      transaction,
      token,
      "account_deletion",
    );

    if (consumed === undefined) {
      return undefined;
    }

    const user = await transaction
      .selectFrom("user")
      .select(["username", "emailAddress"])
      .where("id", "=", consumed.userId)
      .executeTakeFirstOrThrow();

    await transaction
      .deleteFrom("user")
      .where("id", "=", consumed.userId)
      .execute();

    return user;
  });

  if (deleted === undefined) {
    return "invalid_token";
  }

  Mailer.sendInBackground(accountDeletionCompletedMail(deleted));
  return "deleted";
}

export const AccountDeletionService = {
  requestAccountDeletion,
  confirmAccountDeletion,
};
