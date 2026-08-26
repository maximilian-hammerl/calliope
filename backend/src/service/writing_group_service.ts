import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import { NotificationService } from "@/src/service/notification_service.ts";
import type {
  StoryLanguage,
  UserInWritingGroupRole,
  UserInWritingGroupStatus,
  WritingGroup as DatabaseWritingGroup,
  WritingGroupStoryStatus,
  WritingGroupVisibility,
} from "@/src/database/schema.ts";
import { normaliseTags } from "@/src/util/story_tags.ts";
import { emptyToNull } from "@/src/util/optional_text.ts";
import type { User } from "./user_service.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
  searchPattern,
} from "@/src/list/list_endpoint_query.ts";
import {
  type FavouriteFilter,
  FAVOURITES_FIRST,
  withFavourite,
} from "@/src/service/favourite_target.ts";

export type WritingGroup =
  & Pick<
    Selectable<DatabaseWritingGroup>,
    | "id"
    | "title"
    | "subtitle"
    | "synopsis"
    | "visibility"
    | "storyStatus"
    | "genres"
    | "subgenres"
    | "tropes"
    | "contentWarnings"
    | "tense"
    | "perspective"
    | "language"
    | "createdBy"
    | "createdAt"
    | "lastActivityAt"
  >
  // Null once the author has deleted their account, because created_by is ON DELETE SET NULL.
  & { createdByUsername: string | null }
  // The reader's own standing, null for a public group they are not part of.
  & {
    status: UserInWritingGroupStatus | null;
    role: UserInWritingGroupRole | null;
    /** Null unless the reader was invited to this group; the invitations list dates rows by it. */
    invitedAt: string | null;
    /** The reader's own favourite, visible to nobody else. */
    isFavourite: boolean;
  };

/**
 * Which groups a list is asking for, relative to the reader.
 *
 * `joined` is the default because "Meine Gruppen" means the ones somebody belongs to. The
 * older behaviour — every public group plus your own — is `any`, which is right for a search
 * across everything and wrong for a list called mine.
 */
export type MembershipFilter = "joined" | "invited" | "none" | "any";

const SELECTED_COLUMNS = [
  "writingGroup.id",
  "writingGroup.title",
  "writingGroup.subtitle",
  "writingGroup.synopsis",
  "writingGroup.visibility",
  "writingGroup.storyStatus",
  "writingGroup.genres",
  "writingGroup.subgenres",
  "writingGroup.tropes",
  "writingGroup.contentWarnings",
  "writingGroup.tense",
  "writingGroup.perspective",
  "writingGroup.language",
  "writingGroup.createdBy",
  "writingGroup.createdAt",
  "writingGroup.lastActivityAt",
] as const;

/**
 * What a member may set about the story. Every field optional except the two that were always
 * required, so a group created before any of this existed is still describable.
 */
export type WritingGroupValues = {
  title: string;
  synopsis: string;
  subtitle?: string | null;
  visibility?: WritingGroupVisibility;
  storyStatus?: WritingGroupStoryStatus;
  genres?: string[];
  subgenres?: string[];
  tropes?: string[];
  contentWarnings?: string[];
  tense?: string | null;
  perspective?: string | null;
  language?: StoryLanguage;
};

/** The one place values become a row: normalisation cannot be skipped by a caller. */
function toRow(values: Partial<WritingGroupValues>) {
  return {
    ...(values.title === undefined ? {} : { title: values.title.trim() }),
    ...(values.subtitle === undefined
      ? {}
      : { subtitle: emptyToNull(values.subtitle) }),
    ...(values.synopsis === undefined
      ? {}
      : { synopsis: values.synopsis.trim() }),
    ...(values.visibility === undefined
      ? {}
      : { visibility: values.visibility }),
    ...(values.storyStatus === undefined
      ? {}
      : { storyStatus: values.storyStatus }),
    ...(values.genres === undefined
      ? {}
      : { genres: normaliseTags(values.genres) }),
    ...(values.subgenres === undefined
      ? {}
      : { subgenres: normaliseTags(values.subgenres) }),
    ...(values.tropes === undefined
      ? {}
      : { tropes: normaliseTags(values.tropes) }),
    ...(values.contentWarnings === undefined
      ? {}
      : { contentWarnings: normaliseTags(values.contentWarnings) }),
    ...(values.tense === undefined ? {} : { tense: emptyToNull(values.tense) }),
    ...(values.perspective === undefined
      ? {}
      : { perspective: emptyToNull(values.perspective) }),
    ...(values.language === undefined ? {} : { language: values.language }),
  };
}

/**
 * The group and its first membership have to be written together — a group whose creator
 * is not an administrator could never be administered.
 */
async function insertWritingGroup(
  creator: User,
  values: WritingGroupValues,
): Promise<WritingGroup> {
  return await db.transaction().execute(async (transaction) => {
    const writingGroup = await transaction
      .insertInto("writingGroup")
      // title and synopsis restated so the type carries their presence; `toRow` describes a
      // change, where every field may be absent.
      .values({
        ...toRow(values),
        title: values.title.trim(),
        synopsis: values.synopsis.trim(),
        createdBy: creator.id,
      })
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

    // The membership was just written in this transaction, so it is stated rather than
    // re-read: the founder joined their own group as its administrator.
    return {
      ...writingGroup,
      createdByUsername: creator.username,
      status: "joined",
      role: "administrator",
      // Nobody invited the founder, so there is no date to state.
      invitedAt: null,
      // Founding a group does not favourite it: that is the member's own act, and one they can
      // take the moment this returns.
      isFavourite: false,
    };
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

/**
 * Null whenever the left join found no membership, which is exactly the case the interface
 * needs to tell apart: a public group the reader has merely come across.
 */
const OWN_MEMBERSHIP_COLUMNS = [
  "userInWritingGroup.status",
  "userInWritingGroup.role",
  "userInWritingGroup.invitedAt",
] as const;

/**
 * Whether the member may see the group, and their own standing in it — **not** the whole row.
 * Sixteen of the seventeen callers use this as a gate, and a group carries a synopsis of up to
 * eight thousand characters. `selectWritingGroupForReader` is the full read; both build on
 * `visibleToUser`, so the rule is written once and only the projection differs.
 */
export type VisibleWritingGroupGate = {
  id: string;
  title: string;
  visibility: WritingGroupVisibility;
  createdBy: string | null;
  status: UserInWritingGroupStatus | null;
  role: UserInWritingGroupRole | null;
};

async function selectVisibleWritingGroup(
  user: User,
  writingGroupId: string,
): Promise<VisibleWritingGroupGate | undefined> {
  return await visibleToUser(user)
    .select([
      "writingGroup.id",
      "writingGroup.title",
      "writingGroup.visibility",
      "writingGroup.createdBy",
      "userInWritingGroup.status",
      "userInWritingGroup.role",
    ])
    .where("writingGroup.id", "=", writingGroupId)
    .executeTakeFirst();
}

/** The whole group as this reader sees it, favourite included — for the page that renders one. */
async function selectWritingGroupForReader(
  user: User,
  writingGroupId: string,
): Promise<WritingGroup | undefined> {
  return await visibleToUser(user)
    .$call((builder) =>
      withFavourite(builder, "writing_group", "writingGroup.id", user.id)
    )
    .select([
      ...SELECTED_COLUMNS,
      AUTHOR_COLUMN,
      ...OWN_MEMBERSHIP_COLUMNS,
    ])
    .where("writingGroup.id", "=", writingGroupId)
    .executeTakeFirst();
}

function listVisibleWritingGroups(
  user: User,
  query: ListQuery & {
    membership: MembershipFilter;
    favourite: FavouriteFilter;
  },
): Promise<ListResults<WritingGroup>> {
  return listResultsWithCount(
    visibleToUser(user)
      .$call((builder) =>
        withFavourite(builder, "writing_group", "writingGroup.id", user.id)
      )
      .select([
        ...SELECTED_COLUMNS,
        AUTHOR_COLUMN,
        ...OWN_MEMBERSHIP_COLUMNS,
      ])
      // Only the reader's own favourites, which narrows like every other filter here.
      .$if(
        query.favourite === "only",
        (queryBuilder) => queryBuilder.where("favourite.id", "is not", null),
      )
      // Narrows what visibleToUser allows; it never widens it, so a private group the reader
      // has nothing to do with stays out however this is set. One $if per value rather than
      // one clever one: the status literals then type themselves, and "any" is simply the
      // case that matches none of them.
      .$if(
        query.membership === "none",
        // A public group the reader has no membership row for at all.
        (queryBuilder) =>
          queryBuilder.where("userInWritingGroup.userId", "is", null),
      )
      .$if(
        query.membership === "invited",
        (queryBuilder) =>
          queryBuilder.where("userInWritingGroup.status", "=", "invited"),
      )
      .$if(
        query.membership === "joined",
        (queryBuilder) =>
          queryBuilder.where("userInWritingGroup.status", "=", "joined"),
      )
      // Title and description both, since a group is as often remembered by what it is
      // about as by what it is called.
      .$if(
        query.search !== undefined,
        (queryBuilder) =>
          queryBuilder.where((eb) =>
            eb.or([
              // deno-lint-ignore no-non-null-assertion -- the `$if` above only runs this when the term is set
              eb("writingGroup.title", "ilike", searchPattern(query.search!)),
              eb(
                "writingGroup.synopsis",
                "ilike",
                // deno-lint-ignore no-non-null-assertion -- the `$if` above only runs this when the term is set
                searchPattern(query.search!),
              ),
            ])
          ),
      ),
    query,
    FAVOURITES_FIRST,
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
  changes: Partial<WritingGroupValues>,
  changedBy: string,
): Promise<WritingGroup | undefined> {
  return await db.transaction().execute(async (transaction) => {
    // Read first: only a change that actually moves the visibility is worth telling anybody
    // about, and a request may well send the value it already has.
    const before = await transaction
      .selectFrom("writingGroup")
      .select("visibility")
      .where("id", "=", writingGroupId)
      .executeTakeFirst();

    if (before === undefined) {
      return undefined;
    }

    const updated = await transaction
      .updateTable("writingGroup")
      .set(changes)
      .where("id", "=", writingGroupId)
      .returning(["writingGroup.id"])
      .executeTakeFirst();

    if (updated === undefined) {
      return undefined;
    }

    if (
      changes.visibility !== undefined &&
      changes.visibility !== before.visibility
    ) {
      await NotificationService.insertVisibilityChangeNotifications(
        transaction,
        {
          writingGroupId,
          actorId: changedBy,
        },
      );
    }

    // Re-read rather than RETURNING, which cannot reach the joined author name — nor the
    // editor's own membership, which the response carries like every other group does.
    return await transaction
      .selectFrom("writingGroup")
      .leftJoin("user", "user.id", "writingGroup.createdBy")
      .leftJoin(
        "userInWritingGroup",
        (join) =>
          join
            .onRef("userInWritingGroup.writingGroupId", "=", "writingGroup.id")
            .on("userInWritingGroup.userId", "=", changedBy),
      )
      .$call((builder) =>
        withFavourite(builder, "writing_group", "writingGroup.id", changedBy)
      )
      .select([
        ...SELECTED_COLUMNS,
        AUTHOR_COLUMN,
        ...OWN_MEMBERSHIP_COLUMNS,
      ])
      .where("writingGroup.id", "=", updated.id)
      .executeTakeFirstOrThrow();
  });
}

export const WritingGroupService = {
  insertWritingGroup,
  selectVisibleWritingGroup,
  selectWritingGroupForReader,
  listVisibleWritingGroups,
  selectRoleForUser,
  updateWritingGroup,
};
