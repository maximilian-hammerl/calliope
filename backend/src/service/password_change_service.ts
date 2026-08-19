import { db } from "@/src/database/client.ts";
import { hashPassword, verifyPassword } from "@/src/util/password.ts";
import { Mailer } from "@/src/mail/mailer.ts";
import { passwordChangedMail } from "@/src/mail/password_changed_mail.ts";

export type ChangePasswordResult = "changed" | "wrong_password";

/**
 * Changing a password while signed in, which is the counterpart to resetting one while locked
 * out. The current password is required for the same reason the address change requires it: a
 * session that was not the member's must not be enough to lock them out of their own account.
 *
 * Unlike a reset, the session doing the changing survives — signing somebody out of the tab
 * they are working in is a punishment for good hygiene. Every *other* session goes.
 */
async function changePassword(
  userId: string,
  currentSessionId: string,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  const user = await db
    .selectFrom("user")
    .select(["username", "emailAddress", "hashedPassword"])
    .where("id", "=", userId)
    .executeTakeFirstOrThrow();

  if (!await verifyPassword(currentPassword, user.hashedPassword)) {
    return "wrong_password";
  }

  const hashedPassword = await hashPassword(newPassword);

  await db.transaction().execute(async (transaction) => {
    await transaction
      .updateTable("user")
      .set({ hashedPassword })
      .where("id", "=", userId)
      .execute();

    await transaction
      .deleteFrom("userSession")
      .where("userId", "=", userId)
      .where("id", "!=", currentSessionId)
      .execute();

    // An outstanding reset link would still set a password of somebody else's choosing, which
    // is precisely what changing it was meant to stop.
    await transaction
      .deleteFrom("userToken")
      .where("userId", "=", userId)
      .where("purpose", "=", "password_reset")
      .where("consumedAt", "is", null)
      .execute();
  });

  Mailer.sendInBackground(passwordChangedMail({
    username: user.username,
    emailAddress: user.emailAddress,
  }));

  return "changed";
}

export const PasswordChangeService = {
  changePassword,
};
