import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  addMember,
  cleanUp,
  client,
  connect,
  insertGroup,
  insertPost,
  insertThread,
  insertUser,
  lastActivityOf,
} from "./support.ts";

Deno.test.beforeEach(connect);
Deno.test.afterEach(cleanUp);

/** A member, their group and a thread in it: the setting every test here needs. */
async function scenario(
  name: string,
): Promise<{ userId: string; groupId: string; threadId: string }> {
  const userId = await insertUser(`${name}-author`);
  const groupId = await insertGroup(`${name}-group`);
  await addMember(groupId, userId);
  const threadId = await insertThread(groupId, "Kapitel 1", userId);
  return { userId, groupId, threadId };
}

Deno.test("writing a draft leaves the thread and its group untouched", async () => {
  const { userId, groupId, threadId } = await scenario("draft-quiet");

  const threadBefore = await lastActivityOf("writing_thread", threadId);
  const groupBefore = await lastActivityOf("writing_group", groupId);

  const postId = await insertPost(threadId, {
    isDraft: true,
    authorId: userId,
  });

  assertEquals(
    await lastActivityOf("writing_thread", threadId),
    threadBefore,
    "a draft nobody can see must not make the thread look active",
  );
  assertEquals(
    await lastActivityOf("writing_group", groupId),
    groupBefore,
    "and it must not reach the group either",
  );

  // Every autosave is one of these; none of them may move the thread.
  await client.query(
    `UPDATE public.writing_post SET text = 'Weiter geschrieben.' WHERE id = $1`,
    [postId],
  );

  assertEquals(
    await lastActivityOf("writing_thread", threadId),
    threadBefore,
    "editing a draft is still writing a draft",
  );
});

Deno.test("publishing a draft moves the thread and its group", async () => {
  const { userId, groupId, threadId } = await scenario("draft-publish");
  const postId = await insertPost(threadId, {
    isDraft: true,
    authorId: userId,
  });

  const threadBefore = await lastActivityOf("writing_thread", threadId);
  const groupBefore = await lastActivityOf("writing_group", groupId);

  await client.query(
    `UPDATE public.writing_post SET is_draft = false WHERE id = $1`,
    [postId],
  );

  assert(
    await lastActivityOf("writing_thread", threadId) > threadBefore,
    "clearing the draft flag is the moment the writing becomes public",
  );
  assert(
    await lastActivityOf("writing_group", groupId) > groupBefore,
    "and it should propagate up to the group",
  );
});

Deno.test("discarding a draft leaves the thread untouched", async () => {
  const { userId, threadId } = await scenario("draft-discard");
  const postId = await insertPost(threadId, {
    isDraft: true,
    authorId: userId,
  });

  const before = await lastActivityOf("writing_thread", threadId);
  await client.query(`DELETE FROM public.writing_post WHERE id = $1`, [postId]);

  assertEquals(await lastActivityOf("writing_thread", threadId), before);
});

Deno.test("deleting a published post still moves the thread", async () => {
  const { userId, threadId } = await scenario("draft-delete-published");
  const postId = await insertPost(threadId, { authorId: userId });

  const before = await lastActivityOf("writing_thread", threadId);
  await client.query(`DELETE FROM public.writing_post WHERE id = $1`, [postId]);

  assert(
    await lastActivityOf("writing_thread", threadId) > before,
    "the published behaviour must survive the draft exemption",
  );
});

Deno.test("a member has at most one draft per thread", async () => {
  const { userId, threadId } = await scenario("draft-unique");
  await insertPost(threadId, { isDraft: true, authorId: userId });

  await assertRejects(
    () => insertPost(threadId, { isDraft: true, authorId: userId }),
    Error,
    "writing_post_one_draft_per_author",
  );
});

Deno.test("the one-draft rule is per member and per thread", async () => {
  const { userId, groupId, threadId } = await scenario("draft-scope");
  const otherThreadId = await insertThread(groupId, "Kapitel 2", userId);
  const otherUserId = await insertUser("draft-scope-second");
  await addMember(groupId, otherUserId);

  await insertPost(threadId, { isDraft: true, authorId: userId });

  // Neither of these collides: a different thread, and a different member.
  await insertPost(otherThreadId, { isDraft: true, authorId: userId });
  await insertPost(threadId, { isDraft: true, authorId: otherUserId });
});

Deno.test("published posts are not subject to the one-draft rule", async () => {
  const { userId, threadId } = await scenario("draft-published-many");

  await insertPost(threadId, { authorId: userId });
  await insertPost(threadId, { authorId: userId });
});
