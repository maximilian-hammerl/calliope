import type { Selectable } from "kysely";
import { db, type Transaction } from "@/src/database/client.ts";
import { withAvatar } from "@/src/query/user_avatar.ts";
import { withAvatarUrl } from "@/src/http/avatar_url.ts";
import type { UserInChatGroup as DatabaseUserInChatGroup } from "@/src/database/schema.ts";
import { NotificationService } from "@/src/service/notification_service.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
} from "@/src/list/list_endpoint_query.ts";

export type UserInChatGroup =
  & Pick<
    Selectable<DatabaseUserInChatGroup>,
    "userId" | "chatGroupId" | "status" | "invitedAt" | "joinedAt"
  >
  // Never null: the membership is cascade-deleted with its user.
  & { username: string; avatarUrl: string | null };

const SELECTED_COLUMNS = [
  "userInChatGroup.userId",
  "userInChatGroup.chatGroupId",
  "userInChatGroup.status",
  "userInChatGroup.invitedAt",
  "userInChatGroup.joinedAt",
] as const;

function membersWithUsername(executor: typeof db | Transaction = db) {
  return executor
    .selectFrom("userInChatGroup")
    .innerJoin("user", "user.id", "userInChatGroup.userId")
    .select([...SELECTED_COLUMNS, "user.username"])
    .$call((builder) => withAvatar(builder, "user.id"));
}

async function listMembers(
  chatGroupId: string,
  query: ListQuery,
): Promise<ListResults<UserInChatGroup>> {
  const found = await listResultsWithCount(
    membersWithUsername().where(
      "userInChatGroup.chatGroupId",
      "=",
      chatGroupId,
    ),
    query,
  );

  return { ...found, results: found.results.map(withAvatarUrl) };
}

async function selectMembership(
  chatGroupId: string,
  userId: string,
): Promise<UserInChatGroup | undefined> {
  const row = await membersWithUsername()
    .where("userInChatGroup.chatGroupId", "=", chatGroupId)
    .where("userInChatGroup.userId", "=", userId)
    .executeTakeFirst();

  return row === undefined ? undefined : withAvatarUrl(row);
}

/**
 * Always an invitation, never an addition. Anybody in a chat may invite anybody, so without
 * a step the invited person takes, a member could put someone in a room and start writing at
 * them — which on a small private platform is the mechanism for harassment, not a feature.
 */
async function insertInvitation(
  chatGroupId: string,
  userId: string,
  invitedBy: string,
): Promise<UserInChatGroup | undefined> {
  // One transaction: an invitation nobody is told about is the failure that matters.
  return await db.transaction().execute(async (transaction) => {
    const invitation = await transaction
      .insertInto("userInChatGroup")
      .values({ chatGroupId, userId, status: "invited" })
      // Nothing to do when they are already invited or already in it.
      .onConflict((oc) => oc.doNothing())
      .returning(["userId"])
      .executeTakeFirst();

    if (invitation === undefined) {
      // Nothing happened, so nobody is told.
      return undefined;
    }

    await NotificationService.insertChatInvitationNotifications(transaction, {
      recipientIds: [userId],
      chatGroupId,
      actorId: invitedBy,
    });

    return withAvatarUrl(
      await membersWithUsername(transaction)
        .where("userInChatGroup.chatGroupId", "=", chatGroupId)
        .where("userInChatGroup.userId", "=", userId)
        .executeTakeFirstOrThrow(),
    );
  });
}

/** Only the invited user can turn their invitation into a membership. */
async function acceptInvitation(
  chatGroupId: string,
  userId: string,
): Promise<UserInChatGroup | undefined> {
  const updated = await db
    .updateTable("userInChatGroup")
    .set({ status: "joined" })
    .where("chatGroupId", "=", chatGroupId)
    .where("userId", "=", userId)
    .where("status", "=", "invited")
    .returning(["userId"])
    .executeTakeFirst();

  if (updated === undefined) {
    return undefined;
  }

  return await selectMembership(chatGroupId, userId);
}

/**
 * Leaving, and declining, are the same act. Removing the last member also removes the chat,
 * but that is a database trigger rather than something this has to remember.
 */
async function deleteMembership(
  chatGroupId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom("userInChatGroup")
    .where("chatGroupId", "=", chatGroupId)
    .where("userId", "=", userId)
    .executeTakeFirst();

  return Number(result.numDeletedRows) > 0;
}

export const UserInChatGroupService = {
  listMembers,
  selectMembership,
  insertInvitation,
  acceptInvitation,
  deleteMembership,
};
