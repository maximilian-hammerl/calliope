import { assertEquals, assertRejects } from "@std/assert";
import {
  cleanUp,
  client,
  connect,
  firstRow,
  insertGroup,
  TEST_PREFIX,
} from "./support.ts";

Deno.test.beforeEach(connect);
Deno.test.afterEach(async () => {
  // A forum folder belongs to no group, so nothing cascades it away. Children before parents,
  // because the self-reference is RESTRICT and that is checked per row rather than at the end of
  // the statement; these tests nest one level, so two statements cover it.
  // Leaves first: `folder_id` is RESTRICT, so a folder still holding one refuses to go. Written
  // out per table rather than looped, as the two folder statements below are.
  const forumLeaves = (table: string) =>
    `DELETE FROM public.${table} WHERE writing_group_id IS NULL AND title LIKE $1`;
  await client.query(forumLeaves("writing_thread"), [`${TEST_PREFIX}%`]);
  await client.query(forumLeaves("writing_page"), [`${TEST_PREFIX}%`]);

  const forumFolders =
    `DELETE FROM public.writing_folder WHERE writing_group_id IS NULL AND title LIKE $1`;
  await client.query(`${forumFolders} AND parent_folder_id IS NOT NULL`, [
    `${TEST_PREFIX}%`,
  ]);
  await client.query(forumFolders, [`${TEST_PREFIX}%`]);
  await cleanUp();
});

async function insertFolder(
  title: string,
  scope: { writingGroupId: string | null },
  parentFolderId: string | null = null,
): Promise<string> {
  const permission = scope.writingGroupId === null ? "'read'" : "NULL";
  const { rows } = await client.query(
    `INSERT INTO public.writing_folder
       (writing_group_id, parent_folder_id, depth, title,
        member_permission, effective_member_permission)
     VALUES ($1, $2, $3, $4, ${permission}, ${permission})
     RETURNING id`,
    [
      scope.writingGroupId,
      parentFolderId,
      parentFolderId === null ? 1 : 2,
      `${TEST_PREFIX}${title}`,
    ],
  );
  return firstRow<{ id: string }>(rows).id;
}

const FORUM = { writingGroupId: null };

/**
 * A thread and a page take the same two columns, so one helper covers both tables - which is also
 * why one trigger function serves them. `member_permission` follows the scope's CHECK.
 */
async function insertLeaf(
  table: "writing_thread" | "writing_page",
  title: string,
  scope: { writingGroupId: string | null },
  folderId: string | null,
): Promise<string> {
  const permission = scope.writingGroupId === null ? "'write'" : "NULL";
  // A page's body is NOT NULL, and a thread has none - written out per table rather than spliced
  // together, so each statement reads as the SQL it is.
  const statement = table === "writing_page"
    ? `INSERT INTO public.writing_page
         (writing_group_id, folder_id, title, member_permission, document, text)
       VALUES ($1, $2, $3, ${permission}, '{}'::jsonb, '')
       RETURNING id`
    : `INSERT INTO public.writing_thread
         (writing_group_id, folder_id, title, member_permission)
       VALUES ($1, $2, $3, ${permission})
       RETURNING id`;

  const { rows } = await client.query(
    statement,
    [scope.writingGroupId, folderId, `${TEST_PREFIX}${title}`],
  );
  return firstRow<{ id: string }>(rows).id;
}

Deno.test("a folder of the forum may hold another folder of the forum", async () => {
  const parent = await insertFolder("forum-parent", FORUM);
  const child = await insertFolder("forum-child", FORUM, parent);

  const { rows } = await client.query(
    `SELECT parent_folder_id FROM public.writing_folder WHERE id = $1`,
    [child],
  );
  assertEquals(
    firstRow<{ parent_folder_id: string }>(rows).parent_folder_id,
    parent,
  );
});

Deno.test("a folder of the forum cannot be nested under a group's", async () => {
  const groupId = await insertGroup("scope-group");
  const groupFolder = await insertFolder("group-parent", {
    writingGroupId: groupId,
  });

  await assertRejects(
    () => insertFolder("forum-child", FORUM, groupFolder),
    Error,
    "its parent",
  );
});

Deno.test("a group's folder cannot be nested under the forum's", async () => {
  const groupId = await insertGroup("scope-group-2");
  const forumFolder = await insertFolder("forum-parent", FORUM);

  await assertRejects(
    () => insertFolder("group-child", { writingGroupId: groupId }, forumFolder),
    Error,
    "its parent",
  );
});

Deno.test("a folder cannot be moved into the other scope either", async () => {
  const groupId = await insertGroup("scope-group-3");
  const groupFolder = await insertFolder("group-parent", {
    writingGroupId: groupId,
  });
  const forumChild = await insertFolder("forum-child", FORUM);

  await assertRejects(
    () =>
      client.query(
        `UPDATE public.writing_folder SET parent_folder_id = $1 WHERE id = $2`,
        [groupFolder, forumChild],
      ),
    Error,
    "its parent",
  );
});

Deno.test("a rename does not pay for the parent lookup", async () => {
  // The trigger is scoped to the two columns that can break the invariant, so a folder whose
  // parent is legitimate stays writable through every other column.
  const parent = await insertFolder("forum-parent", FORUM);
  const child = await insertFolder("forum-child", FORUM, parent);

  await client.query(
    `UPDATE public.writing_folder SET title = $1 WHERE id = $2`,
    [`${TEST_PREFIX}renamed`, child],
  );

  const { rows } = await client.query(
    `SELECT title FROM public.writing_folder WHERE id = $1`,
    [child],
  );
  assertEquals(
    firstRow<{ title: string }>(rows).title,
    `${TEST_PREFIX}renamed`,
  );
});

Deno.test("a thread of the forum may sit in a folder of the forum", async () => {
  const folder = await insertFolder("forum-room", FORUM);
  const thread = await insertLeaf(
    "writing_thread",
    "forum-thread",
    FORUM,
    folder,
  );

  const { rows } = await client.query(
    `SELECT folder_id FROM public.writing_thread WHERE id = $1`,
    [thread],
  );
  assertEquals(firstRow<{ folder_id: string }>(rows).folder_id, folder);
});

Deno.test("a thread of the forum cannot sit in a group's folder", async () => {
  // Where it would read as being at the forum's root: a group folder carries no effective
  // permission, and that null is what the forum's queries take for "nothing above this".
  const groupId = await insertGroup("leaf-scope-group");
  const groupFolder = await insertFolder("group-room", {
    writingGroupId: groupId,
  });

  await assertRejects(
    () => insertLeaf("writing_thread", "forum-thread", FORUM, groupFolder),
    Error,
    "its folder",
  );
});

Deno.test("a group's thread cannot sit in a folder of the forum", async () => {
  const groupId = await insertGroup("leaf-scope-group-2");
  const forumFolder = await insertFolder("forum-room", FORUM);

  await assertRejects(
    () =>
      insertLeaf(
        "writing_thread",
        "group-thread",
        { writingGroupId: groupId },
        forumFolder,
      ),
    Error,
    "its folder",
  );
});

/** Its own trigger, so a page needs its own case: one function, two tables to attach it to. */
Deno.test("a page cannot cross the scope either, in either direction", async () => {
  const groupId = await insertGroup("leaf-scope-group-3");
  const groupFolder = await insertFolder("group-room", {
    writingGroupId: groupId,
  });
  const forumFolder = await insertFolder("forum-room", FORUM);

  await assertRejects(
    () => insertLeaf("writing_page", "forum-page", FORUM, groupFolder),
    Error,
    "its folder",
  );
  await assertRejects(
    () =>
      insertLeaf(
        "writing_page",
        "group-page",
        { writingGroupId: groupId },
        forumFolder,
      ),
    Error,
    "its folder",
  );
});

Deno.test("a leaf cannot be moved into the other scope", async () => {
  const groupId = await insertGroup("leaf-scope-group-4");
  const groupFolder = await insertFolder("group-room", {
    writingGroupId: groupId,
  });
  const thread = await insertLeaf(
    "writing_thread",
    "forum-thread",
    FORUM,
    null,
  );

  await assertRejects(
    () =>
      client.query(
        `UPDATE public.writing_thread SET folder_id = $1 WHERE id = $2`,
        [groupFolder, thread],
      ),
    Error,
    "its folder",
  );
});

Deno.test("a leaf at the root is not held to it, and a rename pays nothing", async () => {
  // No folder means nothing to disagree with, which is what the `WHEN` clause skips. And the
  // column list is what keeps every other write off the lookup.
  const thread = await insertLeaf("writing_thread", "root-thread", FORUM, null);

  await client.query(
    `UPDATE public.writing_thread SET title = $1 WHERE id = $2`,
    [`${TEST_PREFIX}renamed`, thread],
  );

  const { rows } = await client.query(
    `SELECT title FROM public.writing_thread WHERE id = $1`,
    [thread],
  );
  assertEquals(
    firstRow<{ title: string }>(rows).title,
    `${TEST_PREFIX}renamed`,
  );
});
