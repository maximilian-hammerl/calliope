import type { Selectable } from "kysely";
import { db, type Transaction } from "@/src/database/client.ts";
import { NotificationService } from "@/src/service/notification_service.ts";
import type {
  UserInWritingGroup as DatabaseUserInWritingGroup,
  UserInWritingGroupRole,
} from "@/src/database/schema.ts";

export type UserInWritingGroup =
  & Pick<
    Selectable<DatabaseUserInWritingGroup>,
    | "userId"
    | "writingGroupId"
    | "role"
    | "status"
    | "invitedAt"
    | "joinedAt"
    | "invitedBy"
    | "createdAt"
  >
  // Never null: the membership is cascade-deleted with its user.
  & { username: string }
  // Null for a founder, and once the inviter's account is gone.
  & { invitedByUsername: string | null };

const SELECTED_COLUMNS = [
  "userInWritingGroup.userId",
  "userInWritingGroup.writingGroupId",
  "userInWritingGroup.role",
  "userInWritingGroup.status",
  "userInWritingGroup.invitedAt",
  "userInWritingGroup.joinedAt",
  "userInWritingGroup.invitedBy",
  "userInWritingGroup.createdAt",
] as const;

const RETURNED_COLUMNS = [
  "userId",
  "writingGroupId",
  "role",
  "status",
  "invitedAt",
  "joinedAt",
  "invitedBy",
  "createdAt",
] as const;

/**
 * The member's name is joined in rather than stored, so it follows a rename. Inner, because
 * a membership cannot outlive the user it belongs to.
 */
function membershipsWithUsername(executor: typeof db | Transaction = db) {
  return executor
    .selectFrom("userInWritingGroup")
    .innerJoin("user", "user.id", "userInWritingGroup.userId")
    .select([...SELECTED_COLUMNS, "user.username"])
    // A correlated subquery rather than a second join: an aliased table would widen the
    // builder's table union past what the shared list helper accepts.
    .select((eb) =>
      eb
        .selectFrom("user as inviter")
        .select("inviter.username")
        .whereRef("inviter.id", "=", "userInWritingGroup.invitedBy")
        .as("invitedByUsername")
    );
}

/**
 * Reads one membership back after a write, when the caller has already authorised it. Takes
 * the executor because a read through `db` inside a transaction runs on another connection
 * and cannot see what that transaction has not committed yet.
 */
function membershipWithUsername(
  writingGroupId: string,
  userId: string,
  executor: typeof db | Transaction = db,
) {
  return membershipsWithUsername(executor)
    .where("userInWritingGroup.writingGroupId", "=", writingGroupId)
    .where("userInWritingGroup.userId", "=", userId);
}

/** Always starts as an invitation; only the invited user can turn it into a membership. */
async function insertInvitation(
  writingGroupId: string,
  userId: string,
  role: UserInWritingGroupRole,
  invitedBy: string,
): Promise<UserInWritingGroup | undefined> {
  // One transaction, because an invitation nobody is told about is the failure that matters:
  // the person never finds out, and nothing in the interface would show it went missing.
  return await db.transaction().execute(async (transaction) => {
    const invitation = await transaction
      .insertInto("userInWritingGroup")
      .values({
        writingGroupId,
        userId,
        role,
        status: "invited",
        invitedBy,
      })
      // Nothing to do when the user is already invited or a member.
      .onConflict((oc) => oc.doNothing())
      .returning(RETURNED_COLUMNS)
      .executeTakeFirst();

    if (invitation === undefined) {
      // Nothing happened, so nobody is told.
      return undefined;
    }

    await NotificationService.insertInvitationNotification(transaction, {
      recipientId: userId,
      writingGroupId,
      actorId: invitedBy,
    });

    return await membershipWithUsername(writingGroupId, userId, transaction)
      .executeTakeFirstOrThrow();
  });
}

/** Who can act on a request to get in: every administrator who has actually accepted. */
async function selectJoinedAdministratorIds(
  writingGroupId: string,
): Promise<Array<string>> {
  const administrators = await db
    .selectFrom("userInWritingGroup")
    .select("userId")
    .where("writingGroupId", "=", writingGroupId)
    .where("role", "=", "administrator")
    .where("status", "=", "joined")
    .execute();

  return administrators.map(({ userId }) => userId);
}

async function selectMembership(
  writingGroupId: string,
  userId: string,
): Promise<UserInWritingGroup | undefined> {
  return await membershipWithUsername(writingGroupId, userId)
    .executeTakeFirst();
}

/**
 * Everyone in the group, invitations included, and deliberately not a page.
 *
 * A member missing from the list of who is in a group is worse than a long list: the interface
 * groups joined above invited and sorts by name, which it can only do correctly if it holds all
 * of them. Groups are a handful of people, so there is nothing to page — and if that ever stops
 * being true, this is the place to revisit.
 */
function selectMemberships(
  writingGroupId: string,
): Promise<Array<UserInWritingGroup>> {
  return membershipsWithUsername()
    .where("userInWritingGroup.writingGroupId", "=", writingGroupId)
    .orderBy("user.username", "asc")
    .execute();
}

/** Returns nothing when there is no such membership. Authorisation is the caller's job. */
async function updateRole(
  writingGroupId: string,
  userId: string,
  role: UserInWritingGroupRole,
  changedBy: string,
): Promise<UserInWritingGroup | undefined> {
  return await db.transaction().execute(async (transaction) => {
    const updated = await transaction
      .updateTable("userInWritingGroup")
      .set({ role })
      .where("writingGroupId", "=", writingGroupId)
      .where("userId", "=", userId)
      .returning(RETURNED_COLUMNS)
      .executeTakeFirst();

    if (updated === undefined) {
      return undefined;
    }

    await NotificationService.insertRoleChangeNotification(transaction, {
      recipientId: userId,
      writingGroupId,
      actorId: changedBy,
    });

    return await membershipWithUsername(writingGroupId, userId, transaction)
      .executeTakeFirstOrThrow();
  });
}

/** Only the invited user can turn their invitation into a membership. */
async function acceptInvitation(
  writingGroupId: string,
  userId: string,
): Promise<UserInWritingGroup | undefined> {
  return await db.transaction().execute(async (transaction) => {
    const updated = await transaction
      .updateTable("userInWritingGroup")
      .set({ status: "joined" })
      .where("writingGroupId", "=", writingGroupId)
      .where("userId", "=", userId)
      .where("status", "=", "invited")
      .returning(RETURNED_COLUMNS)
      .executeTakeFirst();

    if (updated === undefined) {
      return undefined;
    }

    await NotificationService.insertInvitationAcceptedNotification(
      transaction,
      {
        invitedBy: updated.invitedBy,
        writingGroupId,
        actorId: userId,
      },
    );

    return await membershipWithUsername(writingGroupId, userId, transaction)
      .executeTakeFirstOrThrow();
  });
}

/**
 * Removing the last member also removes the group, but that is a database trigger rather
 * than something this has to remember: an account deleted directly would bypass a rule that
 * only lived here.
 */
async function deleteMembership(
  writingGroupId: string,
  userId: string,
): Promise<boolean> {
  const deletion = await db
    .deleteFrom("userInWritingGroup")
    .where("writingGroupId", "=", writingGroupId)
    .where("userId", "=", userId)
    .executeTakeFirst();

  return deletion.numDeletedRows > 0n;
}

export const UserInWritingGroupService = {
  selectJoinedAdministratorIds,
  insertInvitation,
  selectMembership,
  selectMemberships,
  updateRole,
  acceptInvitation,
  deleteMembership,
};

/** The user must exist before they can be invited. */
export async function userExists(userId: string): Promise<boolean> {
  const user = await db
    .selectFrom("user")
    .select("id")
    .where("id", "=", userId)
    .executeTakeFirst();

  return user !== undefined;
}
