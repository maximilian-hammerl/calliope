import { assertEquals } from "@std/assert";
import {
  cleanUp,
  client,
  connect,
  firstRow,
  insertGroup,
  TEST_PREFIX,
} from "./support.ts";

/**
 * `effective_member_permission` is derived by the database, not by whoever inserts (#32). These
 * tests are the guarantee: a wrong value is overruled, and a change or a move takes the whole
 * subtree with it - which is what slice 7's operator surface writes through.
 */

Deno.test.beforeEach(connect);
Deno.test.afterEach(async () => {
  // Children before parents: the self-reference is RESTRICT, checked per row. Three levels here.
  const forumFolders =
    `DELETE FROM public.writing_folder WHERE writing_group_id IS NULL AND title LIKE $1`;
  for (const depth of [3, 2]) {
    // deno-lint-ignore no-await-in-loop -- one level at a time, deepest first: that is the point
    await client.query(
      `${forumFolders} AND depth = ${depth}`,
      [`${TEST_PREFIX}%`],
    );
  }
  await client.query(forumFolders, [`${TEST_PREFIX}%`]);
  await cleanUp();
});

/**
 * Deliberately supplies a wrong `effective_member_permission` - 'write', the least restrictive -
 * so every assertion below fails if the trigger is not the thing deciding it.
 */
async function insertForumFolder(
  title: string,
  own: string,
  parentFolderId: string | null = null,
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.writing_folder
       (writing_group_id, parent_folder_id, depth, title,
        member_permission, effective_member_permission)
     VALUES (NULL, $1, $2, $3, $4, 'write')
     RETURNING id`,
    [
      parentFolderId,
      parentFolderId === null ? 1 : 2,
      `${TEST_PREFIX}${title}`,
      own,
    ],
  );
  return firstRow(rows).id;
}

async function effectiveOf(folderId: string): Promise<string | null> {
  const { rows } = await client.query<{
    effective_member_permission: string | null;
  }>(
    `SELECT effective_member_permission FROM public.writing_folder WHERE id = $1`,
    [folderId],
  );
  return firstRow(rows).effective_member_permission;
}

Deno.test("a root folder keeps its own setting, whatever the insert claimed", async () => {
  const folder = await insertForumFolder("announcements", "read");

  assertEquals(await effectiveOf(folder), "read");
});

Deno.test("a child is reduced by its parent, and cannot widen it", async () => {
  const parent = await insertForumFolder("closed", "read");
  const child = await insertForumFolder("open-inside-closed", "write", parent);

  // The child asked for `write` twice over - its own setting and the value it inserted.
  assertEquals(await effectiveOf(child), "read");
});

Deno.test("the reduction runs the whole path, not one step", async () => {
  const top = await insertForumFolder("games", "write");
  const middle = await insertForumFolder("finished", "read", top);
  const bottom = await insertForumFolder("summer", "write", middle);

  assertEquals(await effectiveOf(bottom), "read");
});

Deno.test("changing a folder's permission takes its whole subtree with it", async () => {
  const top = await insertForumFolder("games", "write");
  const middle = await insertForumFolder("finished", "write", top);
  const bottom = await insertForumFolder("summer", "write", middle);

  assertEquals(await effectiveOf(bottom), "write");

  await client.query(
    `UPDATE public.writing_folder SET member_permission = 'hidden' WHERE id = $1`,
    [top],
  );

  // Two levels below the change, which is what the cascade is for.
  assertEquals(await effectiveOf(top), "hidden");
  assertEquals(await effectiveOf(middle), "hidden");
  assertEquals(await effectiveOf(bottom), "hidden");
});

Deno.test("re-opening a folder restores what its children set for themselves", async () => {
  const top = await insertForumFolder("games", "write");
  const middle = await insertForumFolder("announcements", "read", top);
  const bottom = await insertForumFolder("rules", "write", middle);

  await client.query(
    `UPDATE public.writing_folder SET member_permission = 'hidden' WHERE id = $1`,
    [top],
  );
  assertEquals(await effectiveOf(bottom), "hidden");

  await client.query(
    `UPDATE public.writing_folder SET member_permission = 'write' WHERE id = $1`,
    [top],
  );

  // Not back to 'write': the middle folder's own 'read' is still on the path.
  assertEquals(await effectiveOf(middle), "read");
  assertEquals(await effectiveOf(bottom), "read");
});

Deno.test("moving a folder recomputes it and everything under it", async () => {
  const open = await insertForumFolder("games", "write");
  const closed = await insertForumFolder("archive", "read");
  const moving = await insertForumFolder("chain", "write", open);
  const under = await insertForumFolder("round-one", "write", moving);

  assertEquals(await effectiveOf(under), "write");

  await client.query(
    `UPDATE public.writing_folder SET parent_folder_id = $1, depth = 2 WHERE id = $2`,
    [closed, moving],
  );

  assertEquals(await effectiveOf(moving), "read");
  assertEquals(await effectiveOf(under), "read");
});

Deno.test("a writing group's folder is left alone, as its CHECK requires", async () => {
  const groupId = await insertGroup("effective-permission-group");
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO public.writing_folder (writing_group_id, depth, title)
     VALUES ($1, 1, $2) RETURNING id`,
    [groupId, `${TEST_PREFIX}group-folder`],
  );
  const folder = firstRow(rows).id;

  assertEquals(await effectiveOf(folder), null);

  // A rename must not tempt the trigger into writing a value the CHECK forbids.
  await client.query(
    `UPDATE public.writing_folder SET title = $1, member_permission = NULL WHERE id = $2`,
    [`${TEST_PREFIX}renamed`, folder],
  );
  assertEquals(await effectiveOf(folder), null);
});
