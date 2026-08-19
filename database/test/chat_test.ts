import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  addChatMember,
  cleanUp,
  client,
  connect,
  firstRow,
  insertChatGroup,
  insertChatMessage,
  insertUser,
} from "./support.ts";

Deno.test.beforeEach(connect);
Deno.test.afterEach(cleanUp);

async function chat(
  name: string,
): Promise<{ memberId: string; otherId: string; chatGroupId: string }> {
  const memberId = await insertUser(`${name}-member`);
  const otherId = await insertUser(`${name}-other`);
  const chatGroupId = await insertChatGroup(`${name}-chat`);
  await addChatMember(chatGroupId, memberId);
  await addChatMember(chatGroupId, otherId);
  return { memberId, otherId, chatGroupId };
}

async function countChatGroups(chatGroupId: string): Promise<number> {
  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*) FROM public.chat_group WHERE id = $1`,
    [chatGroupId],
  );
  return Number(firstRow(rows).count);
}

async function lastActivityOfChat(chatGroupId: string): Promise<number> {
  const { rows } = await client.query<{ last_activity_at: number }>(
    `SELECT extract(epoch from last_activity_at) AS last_activity_at
     FROM public.chat_group WHERE id = $1`,
    [chatGroupId],
  );
  return firstRow(rows).last_activity_at;
}

Deno.test("an invitation records when it was sent, and nothing else", async () => {
  const userId = await insertUser("chat-invited");
  const chatGroupId = await insertChatGroup("chat-invited-chat");

  await addChatMember(chatGroupId, userId, "invited");

  const { rows } = await client.query<
    { invited_at: string | null; joined_at: string | null }
  >(
    `SELECT invited_at, joined_at FROM public.user_in_chat_group
     WHERE chat_group_id = $1 AND user_id = $2`,
    [chatGroupId, userId],
  );
  assert(firstRow(rows).invited_at !== null);
  assertEquals(firstRow(rows).joined_at, null, "nobody has accepted yet");
});

Deno.test("accepting an invitation records when it was accepted", async () => {
  const userId = await insertUser("chat-accept");
  const chatGroupId = await insertChatGroup("chat-accept-chat");
  await addChatMember(chatGroupId, userId, "invited");

  await client.query(
    `UPDATE public.user_in_chat_group SET status = 'joined'
     WHERE chat_group_id = $1 AND user_id = $2`,
    [chatGroupId, userId],
  );

  const { rows } = await client.query<{ joined_at: string | null }>(
    `SELECT joined_at FROM public.user_in_chat_group
     WHERE chat_group_id = $1 AND user_id = $2`,
    [chatGroupId, userId],
  );
  assert(firstRow(rows).joined_at !== null);
});

Deno.test("a message moves the chat's last activity", async () => {
  const { memberId, chatGroupId } = await chat("chat-activity");
  const before = await lastActivityOfChat(chatGroupId);

  await insertChatMessage(chatGroupId, memberId);

  assert(await lastActivityOfChat(chatGroupId) > before);
});

Deno.test("the chat goes when the last member leaves, not before", async () => {
  const { memberId, otherId, chatGroupId } = await chat("chat-empty");
  await insertChatMessage(chatGroupId, memberId);

  await client.query(
    `DELETE FROM public.user_in_chat_group WHERE chat_group_id = $1 AND user_id = $2`,
    [chatGroupId, memberId],
  );
  assertEquals(
    await countChatGroups(chatGroupId),
    1,
    "one member is still in it",
  );

  await client.query(
    `DELETE FROM public.user_in_chat_group WHERE chat_group_id = $1 AND user_id = $2`,
    [chatGroupId, otherId],
  );
  assertEquals(await countChatGroups(chatGroupId), 0);
});

Deno.test("messages go with the chat, and survive their author", async () => {
  const { memberId, chatGroupId } = await chat("chat-cascade");
  await insertChatMessage(chatGroupId, memberId);

  await client.query(`DELETE FROM public.user WHERE id = $1`, [memberId]);

  // The writing outlives the account, so a message does too, with no author.
  const { rows } = await client.query<
    { count: string; created_by: string | null }
  >(
    `SELECT count(*)::text AS count, max(created_by::text) AS created_by
     FROM public.chat_message WHERE chat_group_id = $1`,
    [chatGroupId],
  );
  assertEquals(Number(firstRow(rows).count), 1);
  assertEquals(firstRow(rows).created_by, null);
});

Deno.test("a chat notification does not outlive the membership", async () => {
  const { memberId, otherId, chatGroupId } = await chat("chat-notification");

  await client.query(
    `INSERT INTO public.notification (recipient_id, chat_group_id, type, actor_id)
     VALUES ($1, $2, 'invited_to_chat_group', $3)`,
    [memberId, chatGroupId, otherId],
  );

  await client.query(
    `DELETE FROM public.user_in_chat_group WHERE chat_group_id = $1 AND user_id = $2`,
    [chatGroupId, memberId],
  );

  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*) FROM public.notification WHERE recipient_id = $1`,
    [memberId],
  );
  assertEquals(Number(firstRow(rows).count), 0);
});

Deno.test("a notification carries one group, never both and never neither", async () => {
  const { memberId, otherId, chatGroupId } = await chat("chat-one-group");
  const writingGroupId = await insertChatGroup("chat-one-group-decoy");

  // Neither.
  await assertRejects(
    () =>
      client.query(
        `INSERT INTO public.notification (recipient_id, type, actor_id)
         VALUES ($1, 'invited_to_chat_group', $2)`,
        [memberId, otherId],
      ),
    Error,
    "notification_subject_matches_type",
  );

  // A chat invitation pointing at a writing group.
  await assertRejects(
    () =>
      client.query(
        `INSERT INTO public.notification (recipient_id, writing_group_id, type, actor_id)
         VALUES ($1, $2, 'invited_to_chat_group', $3)`,
        [memberId, writingGroupId, otherId],
      ),
    Error,
    "notification",
  );

  // And the right one is accepted.
  await client.query(
    `INSERT INTO public.notification (recipient_id, chat_group_id, type, actor_id)
     VALUES ($1, $2, 'invited_to_chat_group', $3)`,
    [memberId, chatGroupId, otherId],
  );
});
