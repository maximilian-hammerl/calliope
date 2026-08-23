import { db } from "@/src/database/client.ts";
import { mayModeratePlatform } from "@/src/service/platform_authorization.ts";
import type { PlatformRole } from "@/src/database/schema.ts";

/**
 * Banning an account for breaking the platform's rules. Three things it deliberately is not:
 *
 * - **Not a block.** `block_service.ts` is one member refusing contact with another, mutual and
 *   about them alone. A ban is an operator acting for the whole site.
 * - **Not a deletion.** `account_deletion_service.ts` frees the name and the address. A ban
 *   holds both, which needs no code: the row stays and `email_address` is UNIQUE.
 * - **Not a retraction of what was written.** Shared writing is joint work and other members'
 *   threads would develop holes. Removing particular content is its own deliberate act.
 */

export type BanTarget = {
  id: string;
  platformRole: PlatformRole | null;
  bannedAt: string | null;
};

export type BanRefusal = "not_found" | "is_an_operator" | "already_banned";

async function selectTarget(userId: string): Promise<BanTarget | undefined> {
  return await db
    .selectFrom("user")
    .select(["id", "platformRole", "bannedAt"])
    .where("id", "=", userId)
    .executeTakeFirst();
}

/**
 * Ending every session is the ban: a member left signed in simply keeps writing until the
 * cookie expires a day later. Same transaction, so an account cannot be marked banned while its
 * sessions survive.
 *
 * An operator cannot be banned, which also settles whether one can ban themselves — they cannot.
 * Demoting first is an administrator's act, so removing an operator takes two deliberate steps
 * by somebody who may take both, rather than one moderator quietly deposing another.
 */
async function banUser(
  userId: string,
  reason: string,
  bannedBy: string,
): Promise<BanRefusal | undefined> {
  const target = await selectTarget(userId);

  if (target === undefined) {
    return "not_found";
  }

  if (mayModeratePlatform(target.platformRole)) {
    return "is_an_operator";
  }

  if (target.bannedAt !== null) {
    return "already_banned";
  }

  await db.transaction().execute(async (transaction) => {
    await transaction
      .updateTable("user")
      .set({
        bannedAt: Temporal.Now.instant().toString(),
        banReason: reason,
        bannedBy,
      })
      .where("id", "=", userId)
      // Nothing may ban an already-banned account twice: the check above races, this does not.
      .where("bannedAt", "is", null)
      .execute();

    await transaction
      .deleteFrom("userSession")
      .where("userId", "=", userId)
      .execute();
  });

  return undefined;
}

/**
 * Lifting restores access and nothing else. The address was never released, so there is nothing
 * to reclaim; the sessions ended at the ban and are not coming back.
 */
async function liftBan(userId: string): Promise<"not_found" | undefined> {
  const lifted = await db
    .updateTable("user")
    .set({ bannedAt: null, banReason: null, bannedBy: null })
    .where("id", "=", userId)
    .where("bannedAt", "is not", null)
    .returning("id")
    .executeTakeFirst();

  return lifted === undefined ? "not_found" : undefined;
}

/**
 * Asked wherever one member reaches another. A banned account answers the *same* neutral
 * refusal as a blocked one — an inviter learning "this account is banned" would be told about a
 * moderation action taken against somebody else.
 *
 * Without this, inviting a banned member succeeds and leaves an invitation they can never
 * answer, because they cannot sign in: pending for ever, and counted in the group's list.
 */
async function isBanned(userId: string): Promise<boolean> {
  const banned = await db
    .selectFrom("user")
    .select("id")
    .where("id", "=", userId)
    .where("bannedAt", "is not", null)
    .executeTakeFirst();

  return banned !== undefined;
}

/** The several-invitees form, mirroring `BlockService.withoutBlocked`. */
async function withoutBanned(
  userIds: ReadonlyArray<string>,
): Promise<Array<string>> {
  if (userIds.length === 0) {
    return [];
  }

  const banned = await db
    .selectFrom("user")
    .select("id")
    .where("id", "in", userIds)
    .where("bannedAt", "is not", null)
    .execute();

  const bannedIds = new Set(banned.map((row) => row.id));
  return userIds.filter((id) => !bannedIds.has(id));
}

export const BanService = { banUser, liftBan, isBanned, withoutBanned };
