import * as z from "zod";
import { db } from "@/src/database/client.ts";
import { generateToken, hashToken } from "@/src/util/token.ts";
import { hashPassword } from "@/src/util/password.ts";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import { runInBackground } from "@/src/util/background.ts";
import { Mailer } from "@/src/mail/mailer.ts";
import { passwordResetMail } from "@/src/mail/password_reset_mail.ts";

/**
 * Long enough to survive a mail server holding the message for a few minutes, short enough
 * that a link left in an inbox stops being a key to the account.
 */
const TOKEN_LIFETIME = Temporal.Duration.from({ hours: 1 });

/**
 * A second request within this window sends nothing. Without it, anyone who knows an address
 * can have that inbox filled by repeating one unauthenticated request; the global rate
 * limiter counts per sender, not per recipient.
 */
const RESEND_COOLDOWN = Temporal.Duration.from({ minutes: 2 });

const HOST_URL = getRequiredEnvVariable("HOST_URL");

/** Matches the column's `uuidv7()` default, so a version the table cannot hold is a miss. */
const TOKEN_ID = z.uuidv7();

/** Like the session cookie: the id finds the row, the secret is compared against it. */
function resetLink(id: string, secret: string): string {
  const url = new URL("/reset-password", HOST_URL);
  url.searchParams.set("token", `${id}.${secret}`);
  return url.toString();
}

function parseToken(
  token: string,
): { id: string; secret: string } | undefined {
  const [id, secret] = token.split(".");

  // The id reaches a uuid column, where anything else is a database error rather than a miss.
  if (!TOKEN_ID.safeParse(id).success || !secret) {
    return undefined;
  }

  return { id, secret };
}

/**
 * Answers nothing in every case, including when nobody has this login. All of the work runs
 * in the background so the request path is identical either way — otherwise the *time* still
 * answers the question the response refuses to.
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

  const secret = generateToken();
  const now = Temporal.Now.instant();

  const issued = await db.transaction().execute(async (transaction) => {
    const outstanding = await transaction
      .selectFrom("userToken")
      .select(["createdAt"])
      .where("userId", "=", user.id)
      .where("purpose", "=", "password_reset")
      .where("consumedAt", "is", null)
      .executeTakeFirst();

    if (outstanding !== undefined) {
      const sentAt = Temporal.Instant.from(outstanding.createdAt);

      if (Temporal.Instant.compare(sentAt.add(RESEND_COOLDOWN), now) > 0) {
        return undefined;
      }
    }

    // Revokes the previous link, and clears an expired row so an abandoned request cannot
    // lock somebody out of asking again.
    await transaction
      .deleteFrom("userToken")
      .where("userId", "=", user.id)
      .where("purpose", "=", "password_reset")
      .where("consumedAt", "is", null)
      .execute();

    // Two requests arriving together each delete nothing the other has inserted yet, so
    // without this the loser violates the partial unique index and fails.
    return await transaction
      .insertInto("userToken")
      .values({
        userId: user.id,
        purpose: "password_reset",
        hashedToken: await hashToken(secret),
        expiresAt: now.add(TOKEN_LIFETIME).toString(),
      })
      .onConflict((oc) =>
        oc
          .columns(["userId", "purpose"])
          .where("consumedAt", "is", null)
          .doNothing()
      )
      .returning(["id"])
      .executeTakeFirst();
  });

  if (issued === undefined) {
    return;
  }

  Mailer.sendInBackground(passwordResetMail({
    username: user.username,
    emailAddress: user.emailAddress,
    link: resetLink(issued.id, secret),
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
  const parsed = parseToken(token);

  if (parsed === undefined) {
    return "invalid_token";
  }

  const hashedToken = await hashToken(parsed.secret);
  const hashedPassword = await hashPassword(password);
  const now = Temporal.Now.instant();

  return await db.transaction().execute(async (transaction) => {
    // Matching the unconsumed row inside the UPDATE is what makes a link single-use under
    // concurrency: the second request waits on the row lock and then no longer matches.
    const consumed = await transaction
      .updateTable("userToken")
      .set({ consumedAt: now.toString() })
      .where("id", "=", parsed.id)
      .where("hashedToken", "=", hashedToken)
      .where("purpose", "=", "password_reset")
      .where("consumedAt", "is", null)
      .where("expiresAt", ">", now.toString())
      .returning(["userId"])
      .executeTakeFirst();

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

async function deleteExpiredTokens(): Promise<number> {
  const result = await db
    .deleteFrom("userToken")
    .where("expiresAt", "<", Temporal.Now.instant().toString())
    .executeTakeFirst();

  return Number(result.numDeletedRows);
}

export const PasswordResetService = {
  requestPasswordReset,
  resetPassword,
  deleteExpiredTokens,
};
