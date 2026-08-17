import type { Selectable } from "kysely";
import { db } from "@/src/database/client.ts";
import type {
  User as DatabaseUser,
  UserSession as DatabaseUserSession,
} from "@/src/database/schema.ts";

export type User = Pick<
  Selectable<DatabaseUser>,
  "id" | "username" | "emailAddress"
>;

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
 * bcrypt work factor. pgcrypto defaults to 6, which is far too cheap on current hardware.
 * Raising it slows every login and registration by design.
 */
const BCRYPT_COST = 12;

async function insertUser(
  username: string,
  password: string,
  emailAddress: string,
): Promise<User | undefined> {
  return await db
    .insertInto("user")
    .values((eb) => ({
      username,
      hashedPassword: eb.fn<string>("crypt", [
        eb.val(password),
        eb.fn<string>("gen_salt", [
          eb.val("bf"),
          eb.val(BCRYPT_COST),
        ]),
      ]),
      emailAddress,
    }))
    .onConflict((oc) => oc.doNothing())
    .returning(["id", "username", "emailAddress"])
    .executeTakeFirst();
}

async function selectUser(
  username: string,
  password: string,
): Promise<User | undefined> {
  return await db
    .selectFrom("user")
    .select(["id", "username", "emailAddress"])
    .where("username", "=", username)
    .where(
      "hashedPassword",
      "=",
      (eb) => eb.fn<string>("crypt", [eb.val(password), "hashedPassword"]),
    )
    .executeTakeFirst();
}

async function insertSessionForUser(
  user: User,
): Promise<UserSession> {
  const sessionToken = crypto.randomUUID();

  const userSession = await db
    .insertInto("userSession")
    .values((eb) => ({
      userId: user.id,
      hashedToken: eb.fn<Buffer>("digest", [
        eb.val(sessionToken),
        eb.val("sha256"),
      ]),
      expiresAt: Temporal.Now.instant().add(SESSION_LIFETIME).toString(),
    }))
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
    .where(
      "hashedToken",
      "=",
      (eb) =>
        eb.fn<Buffer>("digest", [eb.val(userSession.token), eb.val("sha256")]),
    )
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
    .where(
      "hashedToken",
      "=",
      (eb) =>
        eb.fn<Buffer>("digest", [eb.val(userSession.token), eb.val("sha256")]),
    )
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

export const UserService = {
  insertUser,
  selectUser,
  insertSessionForUser,
  selectUserForSession,
  deleteSession,
  deleteExpiredSessions,
};
