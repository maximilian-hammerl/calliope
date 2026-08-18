import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type {
  UserInWritingGroupRole,
  WritingGroup as DatabaseWritingGroup,
  WritingGroupVisibility,
} from "@/src/database/schema.ts";
import type { User } from "./user_service.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
} from "@/src/list_endpoint_query.ts";

export type WritingGroup =
  & Pick<
    Selectable<DatabaseWritingGroup>,
    | "id"
    | "title"
    | "description"
    | "visibility"
    | "createdBy"
    | "createdAt"
    | "updatedAt"
    | "lastActivityAt"
  >
  // Null once the author has deleted their account, because created_by is ON DELETE SET NULL.
  & { createdByUsername: string | null };

const SELECTED_COLUMNS = [
  "writingGroup.id",
  "writingGroup.title",
  "writingGroup.description",
  "writingGroup.visibility",
  "writingGroup.createdBy",
  "writingGroup.createdAt",
  "writingGroup.updatedAt",
  "writingGroup.lastActivityAt",
] as const;

/**
 * The group and its first membership have to be written together — a group whose creator
 * is not an administrator could never be administered.
 */
async function insertWritingGroup(
  creator: User,
  title: string,
  description: string,
  visibility: WritingGroupVisibility,
): Promise<WritingGroup> {
  return await db.transaction().execute(async (transaction) => {
    const writingGroup = await transaction
      .insertInto("writingGroup")
      .values({ title, description, visibility, createdBy: creator.id })
      .returning(SELECTED_COLUMNS)
      .executeTakeFirstOrThrow();

    await transaction
      .insertInto("userInWritingGroup")
      .values({
        userId: creator.id,
        writingGroupId: writingGroup.id,
        role: "administrator",
        // The creator is not invited to their own group.
        status: "joined",
      })
      .execute();

    return { ...writingGroup, createdByUsername: creator.username };
  });
}

/**
 * A group is readable when it is public or when the user is one of its members. The
 * membership join is left, so public groups are returned to non-members too.
 */
function visibleToUser(user: User) {
  return db
    .selectFrom("writingGroup")
    .leftJoin(
      "userInWritingGroup",
      (join) =>
        join
          .onRef("userInWritingGroup.writingGroupId", "=", "writingGroup.id")
          .on("userInWritingGroup.userId", "=", user.id),
    )
    // Left as well: an account that has been deleted leaves the group behind with no author.
    .leftJoin("user", "user.id", "writingGroup.createdBy")
    .where((eb) =>
      eb.or([
        eb("writingGroup.visibility", "=", "public"),
        eb("userInWritingGroup.userId", "is not", null),
      ])
    );
}

/** The author's name is joined in rather than stored, so it follows a rename. */
const AUTHOR_COLUMN = "user.username as createdByUsername" as const;

/** Returns nothing when the group does not exist or is private and not the user's. */
async function selectVisibleWritingGroup(
  user: User,
  writingGroupId: string,
): Promise<WritingGroup | undefined> {
  return await visibleToUser(user)
    .select([...SELECTED_COLUMNS, AUTHOR_COLUMN])
    .where("writingGroup.id", "=", writingGroupId)
    .executeTakeFirst();
}

function listVisibleWritingGroups(
  user: User,
  query: ListQuery,
): Promise<ListResults<WritingGroup>> {
  return listResultsWithCount(
    visibleToUser(user).select([...SELECTED_COLUMNS, AUTHOR_COLUMN]),
    query,
  );
}

/**
 * Only a joined membership carries a role. Someone who has been invited as an
 * administrator has not accepted yet, so they cannot administer the group.
 */
async function selectRoleForUser(
  user: User,
  writingGroupId: string,
): Promise<UserInWritingGroupRole | undefined> {
  const membership = await db
    .selectFrom("userInWritingGroup")
    .select("role")
    .where("writingGroupId", "=", writingGroupId)
    .where("userId", "=", user.id)
    .where("status", "=", "joined")
    .executeTakeFirst();

  return membership?.role;
}

/** Returns nothing when the group does not exist. Authorisation is the caller's job. */
async function updateWritingGroup(
  writingGroupId: string,
  changes: {
    title?: string;
    description?: string;
    visibility?: WritingGroupVisibility;
  },
): Promise<WritingGroup | undefined> {
  const updated = await db
    .updateTable("writingGroup")
    .set(changes)
    .where("id", "=", writingGroupId)
    .returning(["writingGroup.id"])
    .executeTakeFirst();

  if (updated === undefined) {
    return undefined;
  }

  // Re-read rather than RETURNING, which cannot reach the joined author name.
  return await db
    .selectFrom("writingGroup")
    .leftJoin("user", "user.id", "writingGroup.createdBy")
    .select([...SELECTED_COLUMNS, AUTHOR_COLUMN])
    .where("writingGroup.id", "=", updated.id)
    .executeTakeFirstOrThrow();
}

export const WritingGroupService = {
  insertWritingGroup,
  selectVisibleWritingGroup,
  listVisibleWritingGroups,
  selectRoleForUser,
  updateWritingGroup,
};
