import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import { withAvatar } from "@/src/query/user_avatar.ts";
import { avatarUrlOf } from "@/src/http/avatar_url.ts";
import { emptyToNull } from "@/src/util/optional_text.ts";
import { hashPassword, verifyPassword } from "@/src/util/password.ts";
import { generateToken, hashToken } from "@/src/util/token.ts";
import type { SessionProvenance } from "@/src/util/session_provenance.ts";
import {
  type ListQuery,
  type ListResults,
  listResultsWithCount,
  searchPattern,
} from "@/src/list/list_endpoint_query.ts";
import type {
  User as DatabaseUser,
  UserSession as DatabaseUserSession,
} from "@/src/database/schema.ts";

export type User = Pick<
  Selectable<DatabaseUser>,
  | "id"
  | "username"
  | "emailAddress"
  | "emailAddressVerifiedAt"
  // Carried on the session user so an authorisation check costs no query of its own — the
  // reason the role is a column rather than a table of its own.
  | "platformRole"
  // Belt to the braces: banning ends every session, so a banned member should have none. This
  // refuses the one that somehow outlived it, and costs nothing to check.
  | "bannedAt"
>;

/** What one member may see of another. Deliberately narrower than {@link User}. */
export type PublicUser =
  & Pick<Selectable<DatabaseUser>, "id" | "username" | "platformRole">
  & { avatarUrl: string | null };

/** One list, so the select, the update and the response cannot drift apart. */
export const PROFILE_COLUMNS = [
  "aboutMe",
  "writingStyle",
  "postLength",
  "writingFrequency",
  "coWriterExpectations",
  "writingBoundaries",
  "genres",
] as const;

export type ProfileColumn = (typeof PROFILE_COLUMNS)[number];

export type UserProfile =
  & Pick<
    Selectable<DatabaseUser>,
    "id" | "username" | "createdAt" | "platformRole" | ProfileColumn
  >
  & { avatarUrl: string | null };

export type UserSession =
  & Pick<
    Selectable<DatabaseUserSession>,
    "id"
  >
  & { token: string };

/** How long a session stays valid. The session cookie must not outlive this. */
export const SESSION_LIFETIME = Temporal.Duration.from({ hours: 24 });

/**
 * A session is only extended once its remaining lifetime has dropped by this much,
 * so an active user does not cause a write on every single request.
 */
const SESSION_REFRESH_INTERVAL = Temporal.Duration.from({ minutes: 15 });

/**
 * Hashed once at startup and compared against whenever no account matches, so that a
 * username that does not exist costs the same as one with the wrong password. Without it the
 * quick answer would tell an attacker which usernames are real.
 */
const ABSENT_USER_HASH = await hashPassword(generateToken());

async function insertUser(
  username: string,
  password: string,
  emailAddress: string,
): Promise<User | undefined> {
  return await db
    .insertInto("user")
    .values({
      username,
      hashedPassword: await hashPassword(password),
      emailAddress,
    })
    .onConflict((oc) => oc.doNothing())
    .returning([
      "id",
      "username",
      "emailAddress",
      "emailAddressVerifiedAt",
      "platformRole",
      "bannedAt",
    ])
    .executeTakeFirst();
}

async function selectUser(
  usernameOrEmailAddress: string,
  password: string,
): Promise<User | undefined> {
  const user = await db
    .selectFrom("user")
    .select([
      "id",
      "username",
      "emailAddress",
      "emailAddressVerifiedAt",
      "platformRole",
      "bannedAt",
      "hashedPassword",
    ])
    // Addresses are stored lower-cased by the register route, so the comparison has to
    // match that or a differently cased address would never be found.
    .where((eb) =>
      eb.or([
        eb("username", "=", usernameOrEmailAddress),
        eb("emailAddress", "=", usernameOrEmailAddress.toLowerCase()),
      ])
    )
    .executeTakeFirst();

  // The comparison used to happen in SQL, which hid this: hashing only when a row exists
  // makes an unknown username measurably faster to reject than a known one.
  if (user === undefined) {
    await verifyPassword(password, ABSENT_USER_HASH);
    return undefined;
  }

  if (!await verifyPassword(password, user.hashedPassword)) {
    return undefined;
  }

  return {
    id: user.id,
    username: user.username,
    emailAddress: user.emailAddress,
    emailAddressVerifiedAt: user.emailAddressVerifiedAt,
    platformRole: user.platformRole,
    bannedAt: user.bannedAt,
  };
}

async function insertSessionForUser(
  user: User,
  provenance: SessionProvenance,
): Promise<UserSession> {
  const sessionToken = generateToken();

  const userSession = await db
    .insertInto("userSession")
    .values({
      userId: user.id,
      hashedToken: await hashToken(sessionToken),
      expiresAt: Temporal.Now.instant().add(SESSION_LIFETIME).toString(),
      userAgent: provenance.userAgent,
      ipAddress: provenance.ipAddress,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  return {
    id: userSession.id,
    token: sessionToken,
  };
}

async function selectUserForSession(
  userSession: UserSession,
): Promise<User | undefined> {
  const databaseUserSession = await db
    .selectFrom("userSession")
    .select(["id", "userId", "expiresAt"])
    .where("id", "=", userSession.id)
    .where("hashedToken", "=", await hashToken(userSession.token))
    .executeTakeFirst();

  if (databaseUserSession === undefined) {
    return undefined;
  }

  const expiresAt = Temporal.Instant.from(databaseUserSession.expiresAt);

  if (Temporal.Instant.compare(expiresAt, Temporal.Now.instant()) < 0) {
    return undefined;
  }

  const refreshThreshold = Temporal.Now.instant()
    .add(SESSION_LIFETIME)
    .subtract(SESSION_REFRESH_INTERVAL);

  if (Temporal.Instant.compare(expiresAt, refreshThreshold) < 0) {
    await db
      .updateTable("userSession")
      .set({
        expiresAt: Temporal.Now.instant().add(SESSION_LIFETIME).toString(),
      })
      .where("id", "=", databaseUserSession.id)
      .execute();
  }

  return await db
    .selectFrom("user")
    .select([
      "id",
      "username",
      "emailAddress",
      "emailAddressVerifiedAt",
      "platformRole",
      "bannedAt",
    ])
    .where("id", "=", databaseUserSession.userId)
    .executeTakeFirst();
}

/**
 * Matching the token as well as the id means only the holder of a session can delete it.
 * Without that, knowing an id would be enough to end someone else's session.
 */
async function deleteSession(userSession: UserSession): Promise<boolean> {
  const result = await db
    .deleteFrom("userSession")
    .where("id", "=", userSession.id)
    .where("hashedToken", "=", await hashToken(userSession.token))
    .executeTakeFirst();

  return result.numDeletedRows > 0n;
}

/**
 * Every session of one member that is still alive, newest first.
 *
 * `expiresAt` is filtered here rather than trusted: expiry is checked in application code when
 * a session is read, and the rows themselves linger until the hourly sweep — so a list built
 * without this would report sessions that are already dead.
 *
 * Last use is not stored. It is `expiresAt` minus the lifetime, because every request within
 * the refresh interval pushes expiry back to now plus the lifetime.
 */
async function selectSessionsForUser(userId: string) {
  return await db
    .selectFrom("userSession")
    .select(["id", "userAgent", "ipAddress", "createdAt", "expiresAt"])
    .where("userId", "=", userId)
    .where("expiresAt", ">", Temporal.Now.instant().toString())
    .orderBy("createdAt", "desc")
    .execute();
}

/** The panic button: everything but the session asking. */
async function deleteOtherSessions(
  userId: string,
  currentSessionId: string,
): Promise<number> {
  const result = await db
    .deleteFrom("userSession")
    .where("userId", "=", userId)
    .where("id", "!=", currentSessionId)
    .executeTakeFirst();

  return Number(result.numDeletedRows);
}

/**
 * One session, by id. Scoped to the member so an id alone is not enough to end somebody
 * else's — the same reason `deleteSession` also matches on the token.
 */
async function deleteSessionForUser(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom("userSession")
    .where("userId", "=", userId)
    .where("id", "=", sessionId)
    .executeTakeFirst();

  return result.numDeletedRows > 0n;
}

/**
 * Expired sessions are only filtered out when they are read, so nothing ever removes
 * them from the table on its own.
 */
async function deleteExpiredSessions(): Promise<number> {
  const result = await db
    .deleteFrom("userSession")
    .where("expiresAt", "<", Temporal.Now.instant().toString())
    .executeTakeFirst();

  return Number(result.numDeletedRows);
}

/**
 * Finds members by a substring of their name, so someone can be invited by the part of a
 * name that is actually remembered.
 */
async function listUsers(
  query: ListQuery & { hiddenUserIds?: ReadonlyArray<string> },
): Promise<ListResults<PublicUser>> {
  const hidden = query.hiddenUserIds ?? [];

  const found = await listResultsWithCount(
    withAvatar(
      db
        .selectFrom("user")
        .select(["user.id", "user.username", "user.platformRole"]),
      "user.id",
    )
      // Banned accounts are not offered to anybody, the way a blocked one is not offered to the
      // member who blocked them — but for everyone, since a ban is the platform's act rather
      // than one member's. They stay in the groups and conversations they were already part of;
      // this is the list you find somebody *new* in. An operator view needs its own query, which
      // is what #46 says.
      .where("user.bannedAt", "is", null)
      .$if(query.search !== undefined, (queryBuilder) =>
        queryBuilder.where(
          "user.username",
          "ilike",
          // deno-lint-ignore no-non-null-assertion -- the `$if` above only runs this when the term is set
          searchPattern(query.search!),
        ))
      // Blocked in either direction: neither side is shown the other in a list they browse.
      .$if(
        hidden.length > 0,
        (queryBuilder) => queryBuilder.where("user.id", "not in", hidden),
      ),
    query,
  );

  return {
    ...found,
    results: found.results.map(({ avatarFileId, ...user }) => ({
      ...user,
      avatarUrl: avatarUrlOf({ avatarFileId }),
    })),
  };
}

async function selectUserProfile(
  userId: string,
): Promise<UserProfile | undefined> {
  const row = await withAvatar(
    db
      .selectFrom("user")
      .select([
        "user.id",
        "user.username",
        "user.createdAt",
        "user.platformRole",
        ...PROFILE_COLUMNS,
      ]),
    "user.id",
  )
    .where("user.id", "=", userId)
    .executeTakeFirst();

  if (row === undefined) {
    return undefined;
  }

  const { avatarFileId, ...profile } = row;
  return { ...profile, avatarUrl: avatarUrlOf({ avatarFileId }) };
}

/** Absent means unchanged, blank means cleared — a member can empty what they filled in. */
async function updateProfile(
  userId: string,
  changes: Partial<Record<ProfileColumn, string | null>>,
): Promise<UserProfile | undefined> {
  const row: Partial<Record<ProfileColumn, string | null>> = {};

  for (const column of PROFILE_COLUMNS) {
    const value = changes[column];
    if (value !== undefined) {
      row[column] = emptyToNull(value);
    }
  }

  // Postgres will not take an update with nothing to set.
  if (Object.keys(row).length === 0) {
    return await selectUserProfile(userId);
  }

  await db
    .updateTable("user")
    .set(row)
    .where("id", "=", userId)
    .executeTakeFirst();

  // Read back rather than returned: the picture is a join, which an UPDATE cannot carry, and one
  // place building the profile is one place to change when it grows a field.
  return await selectUserProfile(userId);
}

export const UserService = {
  insertUser,
  listUsers,
  selectUserProfile,
  updateProfile,
  selectUser,
  insertSessionForUser,
  selectSessionsForUser,
  deleteOtherSessions,
  deleteSessionForUser,
  selectUserForSession,
  deleteSession,
  deleteExpiredSessions,
};
