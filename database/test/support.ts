// @ts-types="@types/pg"
import pg from "pg";

const DATABASE_URL = Deno.env.get("DATABASE_URL");

if (!DATABASE_URL) {
  throw new Error("Missing DATABASE_URL, cannot run tests");
}

export const client = new pg.Client({
  connectionString: DATABASE_URL,
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
  // Reports outlive their reporter on purpose - the references are SET NULL, not CASCADE - so
  // deleting the accounts leaves them behind. They go by what the fixture wrote into them.
  await client.query(`DELETE FROM public.report WHERE target_excerpt LIKE $1`, [
    `${TEST_PREFIX}%`,
  ]);

  // Users cascade to their memberships, and groups to their threads and posts.
  await client.query(`DELETE FROM public."user" WHERE username LIKE $1`, [
    `${TEST_PREFIX}%`,
  ]);
  await client.query(`DELETE FROM public.writing_group WHERE title LIKE $1`, [
    `${TEST_PREFIX}%`,
  ]);
  await client.query(`DELETE FROM public.chat_group WHERE title LIKE $1`, [
    `${TEST_PREFIX}%`,
  ]);
}

/**
 * The first row of a query that has to return one. Now that `@types/pg` is in place, `firstRow(rows)`
 * is `T | undefined`, and an empty result here is a broken test rather than a missing value,
 * so it says so rather than failing later on a property of undefined.
 */
export function firstRow<T>(rows: T[]): T {
  const [row] = rows;

  if (row === undefined) {
    throw new Error("expected the query to return at least one row");
  }

  return row;
}

export async function insertUser(name: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public."user" (username, hashed_password, email_address)
     VALUES ($1, 'not-a-real-hash', $2) RETURNING id`,
    [`${TEST_PREFIX}${name}`, `${TEST_PREFIX}${name}@example.com`],
  );
  return firstRow(rows).id;
}

export async function insertGroup(title: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.writing_group (title, synopsis, visibility)
     VALUES ($1, 'Beschreibung', 'private') RETURNING id`,
    [`${TEST_PREFIX}${title}`],
  );
  return firstRow(rows).id;
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
  return {
    invitedAt: firstRow(rows).invited_at,
    joinedAt: firstRow(rows).joined_at,
  };
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
  return firstRow(rows).id;
}

export async function insertPost(
  threadId: string,
  { isDraft = false, authorId = null }: {
    isDraft?: boolean;
    authorId?: string | null;
  } = {},
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    // `document` is the body; `text` is the projection the server derives from it. These tests
    // are about triggers rather than content, so both say the same one paragraph.
    `INSERT INTO public.writing_post (writing_thread_id, document, text, is_draft, created_by)
     VALUES ($1, $2, 'Ein Absatz.', $3, $4) RETURNING id`,
    [
      threadId,
      JSON.stringify({
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: "Ein Absatz." }],
        }],
      }),
      isDraft,
      authorId,
    ],
  );
  return firstRow(rows).id;
}

export async function countRows(table: string, id: string): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.${table} WHERE id = $1`,
    [id],
  );
  return Number(firstRow(rows).count);
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
  return Number(firstRow(rows).epoch);
}

/** An invitation notification for a member of a group. Returns its id. */
export async function insertNotification(
  groupId: string,
  recipientId: string,
  { actorId = null, type = "invited_to_writing_group" }: {
    actorId?: string | null;
    type?: string;
  } = {},
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.notification (recipient_id, writing_group_id, type, actor_id)
     VALUES ($1, $2, $3::public.notification_type, $4) RETURNING id`,
    [recipientId, groupId, type, actorId],
  );
  return firstRow(rows).id;
}

export async function countNotifications(recipientId: string): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*) FROM public.notification WHERE recipient_id = $1`,
    [recipientId],
  );
  return Number(firstRow(rows).count);
}

/**
 * Both timestamps as epoch seconds. The driver parses timestamptz into a JS `Date`, which
 * only has milliseconds, so two statements less than a millisecond apart come back equal -
 * the same trap `lastActivityOf` exists to avoid.
 */
export async function notificationTimestamps(
  recipientId: string,
): Promise<{ createdAt: number; occurredAt: number }> {
  const { rows } = await client.query<
    { created_at: number; occurred_at: number }
  >(
    `SELECT extract(epoch from created_at)  AS created_at,
            extract(epoch from occurred_at) AS occurred_at
     FROM public.notification WHERE recipient_id = $1`,
    [recipientId],
  );
  return {
    createdAt: firstRow(rows).created_at,
    occurredAt: firstRow(rows).occurred_at,
  };
}

export async function insertChatGroup(title: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.chat_group (title) VALUES ($1) RETURNING id`,
    [TEST_PREFIX + title],
  );
  return firstRow(rows).id;
}

export async function addChatMember(
  chatGroupId: string,
  userId: string,
  status: "invited" | "joined" = "joined",
): Promise<void> {
  await client.query(
    `INSERT INTO public.user_in_chat_group (user_id, chat_group_id, status)
     VALUES ($1, $2, $3)`,
    [userId, chatGroupId, status],
  );
}

export async function insertChatMessage(
  chatGroupId: string,
  authorId: string | null = null,
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.chat_message (chat_group_id, text, created_by)
     VALUES ($1, 'Kurz.', $2) RETURNING id`,
    [chatGroupId, authorId],
  );
  return firstRow(rows).id;
}

/**
 * A report of one member by another. `target_excerpt` carries the fixture prefix because that is
 * what `cleanUp` finds these rows by. The lifecycle is the two timestamps: `status` is generated
 * from them and cannot be written.
 */
export async function insertReport(
  reporterId: string,
  reportedUserId: string,
  {
    category = "harassment",
    inProgressAt = null,
    closedAt = null,
    closingOutcome = null,
    closingNote = null,
    operatorId = null,
  }: {
    /** Part of the one-report-per-member key, so two reports in one test need two of these. */
    category?: string;
    inProgressAt?: string | null;
    closedAt?: string | null;
    closingOutcome?: string | null;
    closingNote?: string | null;
    operatorId?: string | null;
  } = {},
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.report (reporter_id, target_type, reported_user_id, reported_author_id,
                                target_excerpt, category, reason, operator_id,
                                in_progress_at, closed_at, closing_outcome, closing_note)
     VALUES ($1, 'user', $2, $2, $3, $9::public.report_category, 'Grund', $4, $5, $6,
             $7::public.report_outcome, $8)
     RETURNING id`,
    [
      reporterId,
      reportedUserId,
      `${TEST_PREFIX}excerpt`,
      operatorId,
      inProgressAt,
      closedAt,
      closingOutcome,
      closingNote,
      category,
    ],
  );
  return firstRow(rows).id;
}

/** The status the database derived for a report, which nothing may write. */
export async function reportStatus(reportId: string): Promise<string> {
  const { rows } = await client.query<{ status: string }>(
    `SELECT status FROM public.report WHERE id = $1`,
    [reportId],
  );
  return firstRow(rows).status;
}
