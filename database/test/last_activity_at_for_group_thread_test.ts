import { assert, assertEquals } from "@std/assert";
import {
  addMember,
  cleanUp,
  client,
  close,
  connect,
  firstRow,
  insertGroup,
  insertPost,
  insertThread,
  insertUser,
  lastActivityOf,
} from "./support.ts";

Deno.test.beforeEach(connect);
Deno.test.afterEach(cleanUp);

Deno.test("a new post moves the last activity of its thread and group", async () => {
  const userId = await insertUser("activity-author");
  const groupId = await insertGroup("activity-group");
  await addMember(groupId, userId);
  const threadId = await insertThread(groupId, "Kapitel 1", userId);
  // A second thread proves the trigger narrows to the row the post belongs to.
  const otherThreadId = await insertThread(groupId, "Kapitel 2", userId);

  const groupBefore = await lastActivityOf("writing_group", groupId);
  const threadBefore = await lastActivityOf("writing_thread", threadId);
  const otherBefore = await lastActivityOf("writing_thread", otherThreadId);

  await insertPost(threadId);

  assert(
    await lastActivityOf("writing_thread", threadId) > threadBefore,
    "the thread the post belongs to should have moved",
  );
  assert(
    await lastActivityOf("writing_group", groupId) > groupBefore,
    "the activity should propagate up to the group",
  );
  assertEquals(
    await lastActivityOf("writing_thread", otherThreadId),
    otherBefore,
    "a sibling thread should be untouched",
  );
});

Deno.test("activity is recorded for a thread whose author is gone", async () => {
  const userId = await insertUser("activity-orphan");
  const groupId = await insertGroup("activity-orphan-group");
  await addMember(groupId, userId);

  // `created_by` is ON DELETE SET NULL, so this is the state every thread reaches once its
  // author deletes their account. A trigger testing `NEW IS NOT NULL` breaks here, because
  // for a record that only holds when every single field is non-null.
  const threadId = await insertThread(groupId, "Ohne Autor", null);

  const before = await lastActivityOf("writing_thread", threadId);
  await insertPost(threadId);

  assert(await lastActivityOf("writing_thread", threadId) > before);
});

Deno.test("deleting a post counts as activity too", async () => {
  const userId = await insertUser("activity-delete");
  const groupId = await insertGroup("activity-delete-group");
  await addMember(groupId, userId);
  const threadId = await insertThread(groupId, "Kapitel 1", userId);
  const postId = await insertPost(threadId);

  const before = await lastActivityOf("writing_thread", threadId);
  await client.query(`DELETE FROM public.writing_post WHERE id = $1`, [postId]);

  assert(await lastActivityOf("writing_thread", threadId) > before);
});

Deno.test("deleting a group with content does not error on the way down", async () => {
  const userId = await insertUser("activity-cascade");
  const groupId = await insertGroup("activity-cascade-group");
  await addMember(groupId, userId);
  const threadId = await insertThread(groupId, "Kapitel 1", userId);
  await insertPost(threadId);

  // The cascade removes threads and posts while their triggers are still trying to write
  // back to the rows being removed.
  await client.query(`DELETE FROM public.writing_group WHERE id = $1`, [
    groupId,
  ]);

  const { rows } = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM public.writing_thread WHERE writing_group_id = $1`,
    [groupId],
  );
  assertEquals(Number(firstRow(rows).count), 0);
});

// The pool would otherwise hold the process open after the last test.
globalThis.addEventListener("unload", () => void close());
