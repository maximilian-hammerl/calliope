import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  addMember,
  cleanUp,
  client,
  connect,
  countNotifications,
  firstRow,
  insertGroup,
  insertNotification,
  insertThread,
  insertUser,
  notificationTimestamps,
} from "./support.ts";

Deno.test.beforeEach(connect);
Deno.test.afterEach(cleanUp);

/** An administrator, a member they can act on, and the group both belong to. */
async function group(
  name: string,
): Promise<{ actorId: string; recipientId: string; groupId: string }> {
  const actorId = await insertUser(`${name}-actor`);
  const recipientId = await insertUser(`${name}-recipient`);
  const groupId = await insertGroup(`${name}-group`);
  await addMember(groupId, actorId);
  await addMember(groupId, recipientId, "invited");
  return { actorId, recipientId, groupId };
}

Deno.test("a notification does not outlive the membership it is about", async () => {
  const { actorId, recipientId, groupId } = await group(
    "notification-membership",
  );
  await insertNotification(groupId, recipientId, { actorId });

  // Withdrawing the invitation, which is what removing the membership row is.
  await client.query(
    `DELETE FROM public.user_in_writing_group WHERE writing_group_id = $1 AND user_id = $2`,
    [groupId, recipientId],
  );

  assertEquals(
    await countNotifications(recipientId),
    0,
    "an invitation that no longer exists must not still be announced",
  );
});

Deno.test("a notification for a group you do not belong to cannot be stored", async () => {
  const { groupId } = await group("notification-outsider");
  const outsiderId = await insertUser("notification-outsider-user");

  await assertRejects(
    () => insertNotification(groupId, outsiderId),
    Error,
    "notification_recipient_id_writing_group_id_fkey",
  );
});

Deno.test("deleting the group takes its notifications with it", async () => {
  const { actorId, recipientId, groupId } = await group(
    "notification-group-gone",
  );
  await insertNotification(groupId, recipientId, { actorId });

  await client.query(`DELETE FROM public.writing_group WHERE id = $1`, [
    groupId,
  ]);

  assertEquals(await countNotifications(recipientId), 0);
});

Deno.test("a deleted account leaves its notifications readable", async () => {
  const { actorId, recipientId, groupId } = await group(
    "notification-actor-gone",
  );
  await insertNotification(groupId, recipientId, { actorId });

  await client.query(`DELETE FROM public.user WHERE id = $1`, [actorId]);

  // The recipient still needs to know they were invited, even by a since-deleted account.
  assertEquals(await countNotifications(recipientId), 1);
  const { rows } = await client.query<{ actor_id: string | null }>(
    `SELECT actor_id FROM public.notification WHERE recipient_id = $1`,
    [recipientId],
  );
  assertEquals(firstRow(rows).actor_id, null);
});

Deno.test("nobody is told about their own doing", async () => {
  const { recipientId, groupId } = await group("notification-self");

  await assertRejects(
    () => insertNotification(groupId, recipientId, { actorId: recipientId }),
    Error,
    "notification_actor_is_not_recipient",
  );
});

Deno.test("a type may only carry the subjects it is about", async () => {
  const { actorId, recipientId, groupId } = await group(
    "notification-subjects",
  );
  const threadId = await insertThread(groupId, "Kapitel 1", actorId);

  // An invitation has nothing to do with a thread.
  await assertRejects(
    () =>
      client.query(
        `INSERT INTO public.notification
           (recipient_id, writing_group_id, type, writing_thread_id)
         VALUES ($1, $2, 'invited_to_writing_group', $3)`,
        [recipientId, groupId, threadId],
      ),
    Error,
    "notification_subject_matches_type",
  );

  // And one about a thread cannot leave it out.
  await assertRejects(
    () =>
      client.query(
        `INSERT INTO public.notification (recipient_id, writing_group_id, type)
         VALUES ($1, $2, 'new_writing_thread')`,
        [recipientId, groupId],
      ),
    Error,
    "notification_subject_matches_type",
  );
});

Deno.test("a role change collapses onto one notification per membership", async () => {
  const { actorId, recipientId, groupId } = await group("notification-role");
  const secondActorId = await insertUser("notification-role-second");
  await addMember(groupId, secondActorId);

  await insertNotification(groupId, recipientId, {
    actorId,
    type: "role_changed_in_writing_group",
  });
  await client.query(
    `UPDATE public.notification SET read_at = now() WHERE recipient_id = $1`,
    [recipientId],
  );

  // A second change by a different administrator updates the row rather than adding one.
  const { rows } = await client.query<
    { occurred_at: string; actor_id: string }
  >(
    `INSERT INTO public.notification (recipient_id, writing_group_id, type, actor_id)
     VALUES ($1, $2, 'role_changed_in_writing_group', $3)
     ON CONFLICT (recipient_id, writing_group_id)
       WHERE type = 'role_changed_in_writing_group'
     DO UPDATE SET occurred_at = now(), read_at = NULL, actor_id = excluded.actor_id
     RETURNING occurred_at, actor_id`,
    [recipientId, groupId, secondActorId],
  );

  assertEquals(await countNotifications(recipientId), 1);
  assertEquals(firstRow(rows).actor_id, secondActorId);

  const { rows: read } = await client.query<{ read_at: string | null }>(
    `SELECT read_at FROM public.notification WHERE recipient_id = $1`,
    [recipientId],
  );
  assertEquals(firstRow(read).read_at, null, "a fresh change is unread again");

  // created_at is when the row appeared and does not move; occurred_at is the event.
  const { createdAt, occurredAt } = await notificationTimestamps(recipientId);
  assert(occurredAt > createdAt);
});

Deno.test("occurrence notifications are not collapsed", async () => {
  const { actorId, recipientId, groupId } = await group(
    "notification-occurrences",
  );
  const threadId = await insertThread(groupId, "Kapitel 1", actorId);

  for (let index = 0; index < 2; index++) {
    // deno-lint-ignore no-await-in-loop -- the second insert must land after the first
    await client.query(
      `INSERT INTO public.notification
         (recipient_id, writing_group_id, type, actor_id, writing_thread_id)
       VALUES ($1, $2, 'new_writing_thread', $3, $4)`,
      [recipientId, groupId, actorId, threadId],
    );
  }

  assertEquals(await countNotifications(recipientId), 2);
});
