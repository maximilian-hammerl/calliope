import { assert, assertEquals } from "@std/assert";
import { db } from "@/src/database/client.ts";

const username = "last-activity-test-user";

async function insertUser(): Promise<string> {
  const user = await db
    .insertInto("user")
    .values((eb) => ({
      username,
      hashedPassword: eb.fn<string>("crypt", [
        eb.val("a-complex-password"),
        eb.fn<string>("gen_salt", [eb.val("bf"), eb.val(4)]),
      ]),
      emailAddress: `${username}@example.com`,
    }))
    .returning(["id"])
    .executeTakeFirstOrThrow();

  return user.id;
}

async function insertGroup(createdBy: string): Promise<string> {
  const group = await db
    .insertInto("writingGroup")
    .values({
      title: "Gruppe",
      description: "Beschreibung",
      visibility: "private",
      createdBy,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  return group.id;
}

const lastActivityOfGroup = (id: string) =>
  db.selectFrom("writingGroup").select("lastActivityAt").where("id", "=", id)
    .executeTakeFirstOrThrow();

const lastActivityOfThread = (id: string) =>
  db.selectFrom("thread").select("lastActivityAt").where("id", "=", id)
    .executeTakeFirstOrThrow();

// The user row cascades to everything a test created.
Deno.test.afterEach(async () => {
  await db.deleteFrom("user").where("username", "=", username).execute();
  await db.deleteFrom("writingGroup").where("title", "=", "Gruppe").execute();
});

Deno.test("a new post moves the last activity of its thread and group", async () => {
  const userId = await insertUser();
  const groupId = await insertGroup(userId);
  const thread = await db
    .insertInto("thread")
    .values({ writingGroupId: groupId, title: "Kapitel 1", createdBy: userId })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  // A second thread of the same group must be left alone, so this proves the trigger
  // narrows to the row the post belongs to rather than touching everything.
  const otherThread = await db
    .insertInto("thread")
    .values({ writingGroupId: groupId, title: "Kapitel 2", createdBy: userId })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  const groupBefore = await lastActivityOfGroup(groupId);
  const threadBefore = await lastActivityOfThread(thread.id);
  const otherBefore = await lastActivityOfThread(otherThread.id);

  await db
    .insertInto("post")
    .values({ threadId: thread.id, text: "Ein Absatz.", isDraft: false })
    .execute();

  const groupAfter = await lastActivityOfGroup(groupId);
  const threadAfter = await lastActivityOfThread(thread.id);
  const otherAfter = await lastActivityOfThread(otherThread.id);

  assert(
    threadAfter.lastActivityAt > threadBefore.lastActivityAt,
    "the thread the post belongs to should have moved",
  );
  assert(
    groupAfter.lastActivityAt > groupBefore.lastActivityAt,
    "the activity should propagate up to the group",
  );
  assertEquals(
    otherAfter.lastActivityAt,
    otherBefore.lastActivityAt,
    "a sibling thread should be untouched",
  );
});

Deno.test("activity is recorded for a thread whose author is gone", async () => {
  const userId = await insertUser();
  const groupId = await insertGroup(userId);

  // `created_by` is ON DELETE SET NULL, so this is the state every thread reaches once its
  // author deletes their account. A trigger testing `NEW IS NOT NULL` breaks here, because
  // for a record that only holds when every single field is non-null.
  const thread = await db
    .insertInto("thread")
    .values({ writingGroupId: groupId, title: "Kapitel 1", createdBy: null })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  const before = await lastActivityOfThread(thread.id);

  await db
    .insertInto("post")
    .values({ threadId: thread.id, text: "Ein Absatz.", isDraft: false })
    .execute();

  const after = await lastActivityOfThread(thread.id);
  assert(after.lastActivityAt > before.lastActivityAt);
});

Deno.test("deleting a post is activity too, and deleting a group still works", async () => {
  const userId = await insertUser();
  const groupId = await insertGroup(userId);
  const thread = await db
    .insertInto("thread")
    .values({ writingGroupId: groupId, title: "Kapitel 1", createdBy: userId })
    .returning(["id"])
    .executeTakeFirstOrThrow();
  const post = await db
    .insertInto("post")
    .values({ threadId: thread.id, text: "Ein Absatz.", isDraft: false })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  const before = await lastActivityOfThread(thread.id);

  await db.deleteFrom("post").where("id", "=", post.id).execute();

  const after = await lastActivityOfThread(thread.id);
  assert(after.lastActivityAt > before.lastActivityAt);

  // Groups are deleted when their last member leaves, which cascades through threads and
  // posts while the triggers are trying to write back to the rows being removed.
  await db.deleteFrom("writingGroup").where("id", "=", groupId).execute();

  const remaining = await db
    .selectFrom("thread")
    .select("id")
    .where("writingGroupId", "=", groupId)
    .execute();
  assertEquals(remaining.length, 0);
});
