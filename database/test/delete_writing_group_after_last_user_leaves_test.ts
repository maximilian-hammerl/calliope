import { assertEquals } from "@std/assert";
import {
  addMember,
  cleanUp,
  client,
  close,
  connect,
  countRows,
  insertGroup,
  insertPost,
  insertThread,
  insertUser,
} from "./support.ts";

Deno.test.beforeEach(connect);
Deno.test.afterEach(cleanUp);

const removeMember = (groupId: string, userId: string) =>
  client.query(
    `DELETE FROM public.user_in_writing_group WHERE writing_group_id = $1 AND user_id = $2`,
    [groupId, userId],
  );

Deno.test("a group survives while it still has a member", async () => {
  const groupId = await insertGroup("leave-survives");
  const first = await insertUser("leave-first");
  const second = await insertUser("leave-second");
  await addMember(groupId, first);
  await addMember(groupId, second);

  await removeMember(groupId, first);

  assertEquals(await countRows("writing_group", groupId), 1);
});

Deno.test("the last member out takes the group with them", async () => {
  const groupId = await insertGroup("leave-last");
  const userId = await insertUser("leave-only");
  await addMember(groupId, userId);

  await removeMember(groupId, userId);

  assertEquals(await countRows("writing_group", groupId), 0);
});

Deno.test("deleting the last member's account also removes the group", async () => {
  const groupId = await insertGroup("leave-account");
  const userId = await insertUser("leave-account-user");
  await addMember(groupId, userId);

  // The rule lives in the database rather than in the leave endpoint precisely so that
  // removing a user directly cannot leave a group behind with nobody in it.
  await client.query(`DELETE FROM public."user" WHERE id = $1`, [userId]);

  assertEquals(await countRows("writing_group", groupId), 0);
});

Deno.test("removing every member in one statement removes the group once", async () => {
  const groupId = await insertGroup("leave-multi");
  const first = await insertUser("leave-multi-first");
  const second = await insertUser("leave-multi-second");
  await addMember(groupId, first);
  await addMember(groupId, second);

  // The trigger is per statement, so this fires it once with both departures in its
  // transition table rather than once per row.
  await client.query(
    `DELETE FROM public.user_in_writing_group WHERE writing_group_id = $1`,
    [groupId],
  );

  assertEquals(await countRows("writing_group", groupId), 0);
});

Deno.test("the group's threads and posts go with it", async () => {
  const groupId = await insertGroup("leave-content");
  const userId = await insertUser("leave-content-user");
  await addMember(groupId, userId);
  const threadId = await insertThread(groupId, "Kapitel 1", userId);
  const postId = await insertPost(threadId);

  await removeMember(groupId, userId);

  assertEquals(await countRows("writing_group", groupId), 0);
  assertEquals(await countRows("writing_thread", threadId), 0);
  assertEquals(await countRows("writing_post", postId), 0);
});

Deno.test("a group whose members belong to other groups too is unaffected", async () => {
  const leaving = await insertGroup("leave-scoped-a");
  const other = await insertGroup("leave-scoped-b");
  const userId = await insertUser("leave-scoped-user");
  await addMember(leaving, userId);
  await addMember(other, userId);

  await removeMember(leaving, userId);

  assertEquals(await countRows("writing_group", leaving), 0);
  assertEquals(await countRows("writing_group", other), 1);
});

globalThis.addEventListener("unload", () => void close());
