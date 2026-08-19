import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import { hashPassword, verifyPassword } from "@/src/util/password.ts";
import {
  generateSessionToken,
  hashSessionToken,
} from "@/src/util/session_token.ts";
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
  "id" | "username" | "emailAddress"
>;

/** What one member may see of another. Deliberately narrower than {@link User}. */
export type PublicUser = Pick<Selectable<DatabaseUser>, "id" | "username">;

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
const ABSENT_USER_HASH = await hashPassword(generateSessionToken());

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
    .returning(["id", "username", "emailAddress"])
    .executeTakeFirst();
}

async function selectUser(
  usernameOrEmailAddress: string,
  password: string,
): Promise<User | undefined> {
  const user = await db
    .selectFrom("user")
    .select(["id", "username", "emailAddress", "hashedPassword"])
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
  };
}

async function insertSessionForUser(
  user: User,
): Promise<UserSession> {
  const sessionToken = generateSessionToken();

  const userSession = await db
    .insertInto("userSession")
    .values({
      userId: user.id,
      hashedToken: await hashSessionToken(sessionToken),
      expiresAt: Temporal.Now.instant().add(SESSION_LIFETIME).toString(),
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
    .where("hashedToken", "=", await hashSessionToken(userSession.token))
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
    .select(["id", "username", "emailAddress"])
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
    .where("hashedToken", "=", await hashSessionToken(userSession.token))
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
function listUsers(query: ListQuery): Promise<ListResults<PublicUser>> {
  return listResultsWithCount(
    db
      .selectFrom("user")
      .select(["user.id", "user.username"])
      .$if(query.search !== undefined, (queryBuilder) =>
        queryBuilder.where(
          "user.username",
          "ilike",
          searchPattern(query.search!),
        )),
    query,
  );
}

export const UserService = {
  insertUser,
  listUsers,
  selectUser,
  insertSessionForUser,
  selectUserForSession,
  deleteSession,
  deleteExpiredSessions,
};
