import pg from "pg";

/**
 * These tests exercise the database's own behaviour — triggers, cascades, constraints — so
 * they talk to it directly rather than through the backend's Kysely client. That keeps the
 * migrations verifiable without the backend, and means a test failure points at the SQL
 * rather than at a layer above it.
 */
export const client = new pg.Client({
  connectionString: Deno.env.get("DATABASE_URL"),
});

let connected = false;

export async function connect(): Promise<void> {
  if (!connected) {
    await client.connect();
    connected = true;
  }
}

export async function close(): Promise<void> {
  if (connected) {
    await client.end();
    connected = false;
  }
}

/**
 * Every row a test creates is named with this prefix and removed afterwards, so the tests
 * can run against the development database without taking anything else with them.
 */
export const TEST_PREFIX = "db-test-";

export async function cleanUp(): Promise<void> {
  // Users cascade to their memberships, and groups to their threads and posts.
  await client.query(`DELETE FROM public."user" WHERE username LIKE $1`, [
    `${TEST_PREFIX}%`,
  ]);
  await client.query(`DELETE FROM public.writing_group WHERE title LIKE $1`, [
    `${TEST_PREFIX}%`,
  ]);
}

export async function insertUser(name: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public."user" (username, hashed_password, email_address)
     VALUES ($1, 'not-a-real-hash', $2) RETURNING id`,
    [`${TEST_PREFIX}${name}`, `${TEST_PREFIX}${name}@example.com`],
  );
  return rows[0].id;
}

export async function insertGroup(title: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.writing_group (title, description, visibility)
     VALUES ($1, 'Beschreibung', 'private') RETURNING id`,
    [`${TEST_PREFIX}${title}`],
  );
  return rows[0].id;
}

export async function addMember(
  groupId: string,
  userId: string,
  status: "invited" | "joined" = "joined",
): Promise<void> {
  await client.query(
    `INSERT INTO public.user_in_writing_group (user_id, writing_group_id, role, status)
     VALUES ($1, $2, 'administrator', $3)`,
    [userId, groupId, status],
  );
}

/** The two timestamps the membership trigger maintains, as epoch seconds or null. */
export async function membershipTimestamps(
  groupId: string,
  userId: string,
): Promise<{ invitedAt: number | null; joinedAt: number | null }> {
  const { rows } = await client.query<
    { invited_at: number | null; joined_at: number | null }
  >(
    `SELECT extract(epoch from invited_at) AS invited_at,
            extract(epoch from joined_at)  AS joined_at
     FROM public.user_in_writing_group
     WHERE writing_group_id = $1 AND user_id = $2`,
    [groupId, userId],
  );
  return { invitedAt: rows[0].invited_at, joinedAt: rows[0].joined_at };
}

export async function insertThread(
  groupId: string,
  title: string,
  createdBy: string | null = null,
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.writing_thread (writing_group_id, title, created_by)
     VALUES ($1, $2, $3) RETURNING id`,
    [groupId, title, createdBy],
  );
  return rows[0].id;
}

export async function insertPost(
  threadId: string,
  { isDraft = false, authorId = null }: {
    isDraft?: boolean;
    authorId?: string | null;
  } = {},
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.writing_post (writing_thread_id, text, is_draft, created_by)
     VALUES ($1, 'Ein Absatz.', $2, $3) RETURNING id`,
    [threadId, isDraft, authorId],
  );
  return rows[0].id;
}

export async function countRows(table: string, id: string): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.${table} WHERE id = $1`,
    [id],
  );
  return Number(rows[0].count);
}

/**
 * Returned as seconds since the epoch rather than as a Date: the driver hands back a JS
 * Date, whose string form compares lexicographically and so orders "Tue" before "Wed"
 * regardless of the actual instant. The epoch keeps the column's microsecond resolution,
 * which two writes in the same millisecond need.
 */
export async function lastActivityOf(
  table: string,
  id: string,
): Promise<number> {
  const { rows } = await client.query<{ epoch: string }>(
    `SELECT extract(epoch FROM last_activity_at)::text AS epoch
     FROM public.${table} WHERE id = $1`,
    [id],
  );
  return Number(rows[0].epoch);
}
