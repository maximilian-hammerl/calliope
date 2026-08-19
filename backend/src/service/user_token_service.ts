import type { Transaction } from "kysely";
import { db } from "@/src/database/client.ts";
import type { DB, UserTokenPurpose } from "@/src/database/schema.ts";
import {
  formatToken,
  generateToken,
  hashToken,
  parseToken,
} from "@/src/util/token.ts";

/**
 * One lifetime for every purpose. A verification link could reasonably live longer than a
 * reset link, but two numbers that happen to agree drift; when the feedback says an hour is
 * too short, this is the single place to change.
 */
export const TOKEN_LIFETIME = Temporal.Duration.from({ hours: 1 });

/**
 * A second request within this window sends nothing. Without it, anyone who can reach the
 * endpoint can have somebody's inbox filled by repeating one request; the global rate limiter
 * counts per sender, not per recipient.
 */
const RESEND_COOLDOWN = Temporal.Duration.from({ minutes: 2 });

/**
 * Returns the token to put in the link, or undefined when the cooldown swallowed the request
 * — which callers treat as success, because saying otherwise would report on somebody else's
 * inbox.
 */
async function issueToken(
  userId: string,
  purpose: UserTokenPurpose,
): Promise<string | undefined> {
  const secret = generateToken();
  const now = Temporal.Now.instant();

  const issued = await db.transaction().execute(async (transaction) => {
    const outstanding = await transaction
      .selectFrom("userToken")
      .select(["createdAt"])
      .where("userId", "=", userId)
      .where("purpose", "=", purpose)
      .where("consumedAt", "is", null)
      .executeTakeFirst();

    if (outstanding !== undefined) {
      const sentAt = Temporal.Instant.from(outstanding.createdAt);

      if (Temporal.Instant.compare(sentAt.add(RESEND_COOLDOWN), now) > 0) {
        return undefined;
      }
    }

    // Issuing revokes the previous link, and clears an expired row so an abandoned request
    // cannot lock somebody out of asking again.
    await transaction
      .deleteFrom("userToken")
      .where("userId", "=", userId)
      .where("purpose", "=", purpose)
      .where("consumedAt", "is", null)
      .execute();

    // Two requests arriving together each delete nothing the other has inserted yet, so
    // without this the loser violates the partial unique index and fails.
    return await transaction
      .insertInto("userToken")
      .values({
        userId,
        purpose,
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

  return issued === undefined ? undefined : formatToken(issued.id, secret);
}

/**
 * Spends a token and returns whose it was. Takes the caller's transaction so that consuming
 * and whatever the token authorises either both happen or neither does.
 *
 * Matching the unconsumed row inside the UPDATE is what makes a link single-use under
 * concurrency: a second request waits on the row lock and then no longer matches. The purpose
 * is part of the match, so a token issued for one thing cannot be spent on another.
 */
async function consumeToken(
  transaction: Transaction<DB>,
  token: string,
  purpose: UserTokenPurpose,
): Promise<string | undefined> {
  const parsed = parseToken(token);

  if (parsed === undefined) {
    return undefined;
  }

  const now = Temporal.Now.instant();

  const consumed = await transaction
    .updateTable("userToken")
    .set({ consumedAt: now.toString() })
    .where("id", "=", parsed.id)
    .where("hashedToken", "=", await hashToken(parsed.secret))
    .where("purpose", "=", purpose)
    .where("consumedAt", "is", null)
    .where("expiresAt", ">", now.toString())
    .returning(["userId"])
    .executeTakeFirst();

  return consumed?.userId;
}

/** Expired rows are only filtered out when they are read, so nothing removes them on its own. */
async function deleteExpiredTokens(): Promise<number> {
  const result = await db
    .deleteFrom("userToken")
    .where("expiresAt", "<", Temporal.Now.instant().toString())
    .executeTakeFirst();

  return Number(result.numDeletedRows);
}

export const UserTokenService = {
  issueToken,
  consumeToken,
  deleteExpiredTokens,
};
