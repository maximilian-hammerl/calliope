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
  searchPattern,
} from "@/src/list_endpoint_query.ts";

export type UserInWritingGroup =
  & Pick<
    Selectable<DatabaseUserInWritingGroup>,
    "userId" | "writingGroupId" | "role" | "status" | "createdAt" | "updatedAt"
  >
  // Never null: the membership is cascade-deleted with its user.
  & { username: string };

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

/**
 * The member's name is joined in rather than stored, so it follows a rename. Inner, because
 * a membership cannot outlive the user it belongs to.
 */
function membershipsWithUsername() {
  return db
    .selectFrom("userInWritingGroup")
    .innerJoin("user", "user.id", "userInWritingGroup.userId")
    .select([...SELECTED_COLUMNS, "user.username"]);
}

/** Reads one membership back after a write, when the caller has already authorised it. */
function membershipWithUsername(writingGroupId: string, userId: string) {
  return membershipsWithUsername()
    .where("userInWritingGroup.writingGroupId", "=", writingGroupId)
    .where("userInWritingGroup.userId", "=", userId);
}

/** Always starts as an invitation; only the invited user can turn it into a membership. */
async function insertInvitation(
  writingGroupId: string,
  userId: string,
  role: UserInWritingGroupRole,
): Promise<UserInWritingGroup | undefined> {
  const invitation = await db
    .insertInto("userInWritingGroup")
    .values({ writingGroupId, userId, role, status: "invited" })
    // Nothing to do when the user is already invited or a member.
    .onConflict((oc) => oc.doNothing())
    .returning(RETURNED_COLUMNS)
    .executeTakeFirst();

  if (invitation === undefined) {
    return undefined;
  }

  return await membershipWithUsername(writingGroupId, userId)
    .executeTakeFirstOrThrow();
}

async function selectMembership(
  writingGroupId: string,
  userId: string,
): Promise<UserInWritingGroup | undefined> {
  return await membershipWithUsername(writingGroupId, userId)
    .executeTakeFirst();
}

function listMemberships(
  writingGroupId: string,
  query: ListQuery,
): Promise<ListResults<UserInWritingGroup>> {
  return listResultsWithCount(
    membershipsWithUsername()
      .where("userInWritingGroup.writingGroupId", "=", writingGroupId)
      .$if(query.search !== undefined, (queryBuilder) =>
        queryBuilder.where(
          "user.username",
          "ilike",
          searchPattern(query.search!),
        )),
    query,
  );
}

/** Returns nothing when there is no such membership. Authorisation is the caller's job. */
async function updateRole(
  writingGroupId: string,
  userId: string,
  role: UserInWritingGroupRole,
): Promise<UserInWritingGroup | undefined> {
  const updated = await db
    .updateTable("userInWritingGroup")
    .set({ role })
    .where("writingGroupId", "=", writingGroupId)
    .where("userId", "=", userId)
    .returning(RETURNED_COLUMNS)
    .executeTakeFirst();

  if (updated === undefined) {
    return undefined;
  }

  return await membershipWithUsername(writingGroupId, userId)
    .executeTakeFirstOrThrow();
}

/**
 * Only an invitation can be accepted, so a membership that is already joined is left
 * alone and reported back as unchanged.
 */
async function acceptInvitation(
  writingGroupId: string,
  userId: string,
): Promise<UserInWritingGroup | undefined> {
  const updated = await db
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

  return await membershipWithUsername(writingGroupId, userId)
    .executeTakeFirstOrThrow();
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
