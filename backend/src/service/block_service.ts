import { db, type Transaction } from "@/src/database/client.ts";
import type { ListQuery, ListResults } from "@/src/list/list_endpoint_query.ts";
import { listResultsWithCount } from "@/src/list/list_endpoint_query.ts";

export type Block = {
  blockedId: string;
  /** Never null: the row is cascade-deleted with either account. */
  username: string;
  createdAt: string;
};

/**
 * Blocking is symmetric for contact: a row in either direction refuses it. If it were not,
 * blocking somebody would still leave them able to invite you, which is the one thing it is
 * for.
 */
async function isBlockedBetween(
  oneUserId: string,
  otherUserId: string,
): Promise<boolean> {
  const block = await db
    .selectFrom("userBlock")
    .select("blockerId")
    .where((eb) =>
      eb.or([
        eb.and([
          eb("blockerId", "=", oneUserId),
          eb("blockedId", "=", otherUserId),
        ]),
        eb.and([
          eb("blockerId", "=", otherUserId),
          eb("blockedId", "=", oneUserId),
        ]),
      ])
    )
    .executeTakeFirst();

  return block !== undefined;
}

/** Only this member's own block, for a profile page deciding which button to offer. */
async function isBlockedByUser(
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const block = await db
    .selectFrom("userBlock")
    .select("blockerId")
    .where("blockerId", "=", blockerId)
    .where("blockedId", "=", blockedId)
    .executeTakeFirst();

  return block !== undefined;
}

/**
 * Whichever of `userIds` this member has no block with, in the order given. For invitations
 * that name several people at once: one administrator's block must not make a whole group
 * unreachable.
 */
async function withoutBlocked(
  userId: string,
  userIds: ReadonlyArray<string>,
): Promise<Array<string>> {
  if (userIds.length === 0) {
    return [];
  }

  const blocks = await db
    .selectFrom("userBlock")
    .select(["blockerId", "blockedId"])
    .where((eb) =>
      eb.or([
        eb.and([eb("blockerId", "=", userId), eb("blockedId", "in", userIds)]),
        eb.and([eb("blockedId", "=", userId), eb("blockerId", "in", userIds)]),
      ])
    )
    .execute();

  const blocked = new Set(
    blocks.flatMap(({ blockerId, blockedId }) => [blockerId, blockedId]),
  );

  return userIds.filter((candidate) => !blocked.has(candidate));
}

/** Every account this member has blocked, for the list they manage in the settings. */
function listBlocks(
  blockerId: string,
  query: ListQuery,
): Promise<ListResults<Block>> {
  return listResultsWithCount(
    db
      .selectFrom("userBlock")
      .innerJoin("user", "user.id", "userBlock.blockedId")
      .select([
        "userBlock.blockedId",
        "userBlock.createdAt",
        "user.username",
      ])
      .where("userBlock.blockerId", "=", blockerId),
    query,
  );
}

/** Every account in either direction, which is what a list must hide from this member. */
async function selectBlockedIds(userId: string): Promise<Array<string>> {
  const blocks = await db
    .selectFrom("userBlock")
    .select(["blockerId", "blockedId"])
    .where((eb) =>
      eb.or([eb("blockerId", "=", userId), eb("blockedId", "=", userId)])
    )
    .execute();

  return blocks.map(({ blockerId, blockedId }) =>
    blockerId === userId ? blockedId : blockerId
  );
}

/**
 * Pending invitations between the two go with the block, in both directions: an unanswered
 * invitation is an outstanding contact attempt, and leaving it live while blocking its sender
 * would fail at the one thing blocking does. Joined memberships are left alone — a shared group
 * or chat is somebody's own to leave.
 */
async function cancelPendingInvitations(
  transaction: Transaction,
  oneUserId: string,
  otherUserId: string,
): Promise<void> {
  const pair = [oneUserId, otherUserId];

  await transaction
    .deleteFrom("userInWritingGroup")
    .where("status", "=", "invited")
    .where("userId", "in", pair)
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("userInWritingGroup as counterpart")
          .select("counterpart.userId")
          .whereRef(
            "counterpart.writingGroupId",
            "=",
            "userInWritingGroup.writingGroupId",
          )
          .where("counterpart.userId", "in", pair)
          .whereRef("counterpart.userId", "!=", "userInWritingGroup.userId"),
      )
    )
    .execute();

  await transaction
    .deleteFrom("userInChatGroup")
    .where("status", "=", "invited")
    .where("userId", "in", pair)
    .where((eb) =>
      eb.exists(
        eb
          .selectFrom("userInChatGroup as counterpart")
          .select("counterpart.userId")
          .whereRef(
            "counterpart.chatGroupId",
            "=",
            "userInChatGroup.chatGroupId",
          )
          .where("counterpart.userId", "in", pair)
          .whereRef("counterpart.userId", "!=", "userInChatGroup.userId"),
      )
    )
    .execute();
}

/** Idempotent: blocking somebody already blocked changes nothing and still succeeds. */
async function insertBlock(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  await db.transaction().execute(async (transaction) => {
    await transaction
      .insertInto("userBlock")
      .values({ blockerId, blockedId })
      .onConflict((oc) => oc.doNothing())
      .execute();

    await cancelPendingInvitations(transaction, blockerId, blockedId);
  });
}

async function deleteBlock(
  blockerId: string,
  blockedId: string,
): Promise<boolean> {
  const deletion = await db
    .deleteFrom("userBlock")
    .where("blockerId", "=", blockerId)
    .where("blockedId", "=", blockedId)
    .executeTakeFirst();

  return deletion.numDeletedRows > 0n;
}

export const BlockService = {
  isBlockedBetween,
  isBlockedByUser,
  withoutBlocked,
  listBlocks,
  selectBlockedIds,
  insertBlock,
  deleteBlock,
};
