import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type {
  UserInWritingGroup as DatabaseUserInWritingGroup,
  UserInWritingGroupRole,
} from "@/src/database/schema.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
} from "@/src/list_endpoint_query.ts";

export type UserInWritingGroup = Pick<
  Selectable<DatabaseUserInWritingGroup>,
  "userId" | "writingGroupId" | "role" | "status" | "createdAt" | "updatedAt"
>;

const SELECTED_COLUMNS = [
  "userInWritingGroup.userId",
  "userInWritingGroup.writingGroupId",
  "userInWritingGroup.role",
  "userInWritingGroup.status",
  "userInWritingGroup.createdAt",
  "userInWritingGroup.updatedAt",
] as const;

const RETURNED_COLUMNS = [
  "userId",
  "writingGroupId",
  "role",
  "status",
  "createdAt",
  "updatedAt",
] as const;

/** Always starts as an invitation; only the invited user can turn it into a membership. */
async function insertInvitation(
  writingGroupId: string,
  userId: string,
  role: UserInWritingGroupRole,
): Promise<UserInWritingGroup | undefined> {
  return await db
    .insertInto("userInWritingGroup")
    .values({ writingGroupId, userId, role, status: "invited" })
    // Nothing to do when the user is already invited or a member.
    .onConflict((oc) => oc.doNothing())
    .returning(RETURNED_COLUMNS)
    .executeTakeFirst();
}

async function selectMembership(
  writingGroupId: string,
  userId: string,
): Promise<UserInWritingGroup | undefined> {
  return await db
    .selectFrom("userInWritingGroup")
    .select(SELECTED_COLUMNS)
    .where("writingGroupId", "=", writingGroupId)
    .where("userId", "=", userId)
    .executeTakeFirst();
}

function listMemberships(
  writingGroupId: string,
  query: ListQuery,
): Promise<ListResults<UserInWritingGroup>> {
  return listResultsWithCount(
    db
      .selectFrom("userInWritingGroup")
      .select(SELECTED_COLUMNS)
      .where("writingGroupId", "=", writingGroupId),
    query,
  );
}

/** Returns nothing when there is no such membership. Authorisation is the caller's job. */
async function updateRole(
  writingGroupId: string,
  userId: string,
  role: UserInWritingGroupRole,
): Promise<UserInWritingGroup | undefined> {
  return await db
    .updateTable("userInWritingGroup")
    .set({ role })
    .where("writingGroupId", "=", writingGroupId)
    .where("userId", "=", userId)
    .returning(RETURNED_COLUMNS)
    .executeTakeFirst();
}

/**
 * Only an invitation can be accepted, so a membership that is already joined is left
 * alone and reported back as unchanged.
 */
async function acceptInvitation(
  writingGroupId: string,
  userId: string,
): Promise<UserInWritingGroup | undefined> {
  return await db
    .updateTable("userInWritingGroup")
    .set({ status: "joined" })
    .where("writingGroupId", "=", writingGroupId)
    .where("userId", "=", userId)
    .where("status", "=", "invited")
    .returning(RETURNED_COLUMNS)
    .executeTakeFirst();
}

export type MembershipRemoval = {
  removed: boolean;
  /** Groups exist only for their members, so the last one out takes the group with them. */
  writingGroupDeleted: boolean;
};

async function deleteMembership(
  writingGroupId: string,
  userId: string,
): Promise<MembershipRemoval> {
  return await db.transaction().execute(async (transaction) => {
    const deletion = await transaction
      .deleteFrom("userInWritingGroup")
      .where("writingGroupId", "=", writingGroupId)
      .where("userId", "=", userId)
      .executeTakeFirst();

    if (deletion.numDeletedRows === 0n) {
      return { removed: false, writingGroupDeleted: false };
    }

    const { remaining } = await transaction
      .selectFrom("userInWritingGroup")
      .select((eb) => eb.fn.countAll<number>().as("remaining"))
      .where("writingGroupId", "=", writingGroupId)
      .executeTakeFirstOrThrow();

    if (Number(remaining) > 0) {
      return { removed: true, writingGroupDeleted: false };
    }

    await transaction
      .deleteFrom("writingGroup")
      .where("id", "=", writingGroupId)
      .execute();

    return { removed: true, writingGroupDeleted: true };
  });
}

export const UserInWritingGroupService = {
  insertInvitation,
  selectMembership,
  listMemberships,
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
