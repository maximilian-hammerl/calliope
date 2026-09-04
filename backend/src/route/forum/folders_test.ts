import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";
import { clearForum, createForumThread } from "@/src/test/forum.ts";
import { makeOperator } from "@/src/test/reports.ts";
import { MAX_FOLDER_DEPTH } from "@/src/service/writing_folder_service.ts";

const member = "forum-folders-member";
const operator = "forum-folders-operator";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(async () => {
  await clearForum([member, operator]);
  await deleteUsers([member, operator]);
});

const create = (
  cookie: string,
  title: string,
  memberPermission: string,
  parentFolderId?: string,
) =>
  request("POST", "/api/forum/folders", cookie, {
    title,
    memberPermission,
    ...(parentFolderId === undefined ? {} : { parentFolderId }),
  });

async function operatorAndMember(): Promise<[string, string]> {
  const memberCookie = await registerUser(member);
  const operatorCookie = await makeOperator(
    operator,
    await registerUser(operator),
  );
  return [operatorCookie, memberCookie];
}

Deno.test("POST /api/forum/folders: an operator's alone, since the forum has no administrators", async () => {
  const [operatorCookie, memberCookie] = await operatorAndMember();

  assertEquals(
    (await create(memberCookie, "Mein Ordner", "write")).status,
    STATUS_CODE.Forbidden,
  );

  const created = await create(operatorCookie, "Forenspiele", "write");
  assertEquals(created.status, STATUS_CODE.Created);

  const folder = await created.json();
  assertEquals(folder.title, "Forenspiele");
  assertEquals(folder.depth, 1);
  assertEquals(folder.effectiveMemberPermission, "write");
  assertEquals(folder.createdByUsername, operator);
});

Deno.test("a folder cannot widen the one it is created in", async () => {
  const [operatorCookie] = await operatorAndMember();

  const closed = await (await create(operatorCookie, "Ankündigungen", "read"))
    .json();
  const inside = await (await create(
    operatorCookie,
    "Regeln",
    "write",
    closed.id,
  )).json();

  // Both are sent, and they differ: `write` is what was asked for and is kept, so re-opening the
  // folder above restores it; `read` is what the path answers, derived by the database.
  assertEquals(inside.memberPermission, "write");
  assertEquals(inside.effectiveMemberPermission, "read");
  assertEquals(inside.depth, 2);
});

Deno.test("a folder of a writing group is not a parent the forum will accept", async () => {
  const [operatorCookie] = await operatorAndMember();
  // Through the helper, which asserts the group was made: hand-rolling the body left `groupFolder`
  // undefined, and an undefined parent is simply absent once `JSON.stringify` has dropped it - so
  // the folder was created at the root and the test passed for the wrong reason.
  const group = await createGroup(operatorCookie, "Der Zauberzwerg");
  const groupFolder = await (await request(
    "POST",
    `/api/groups/${group.id}/folders`,
    operatorCookie,
    { title: "Weltenbau" },
  )).json();
  assertEquals(typeof groupFolder.id, "string");

  assertEquals(
    (await create(operatorCookie, "Geliehen", "write", groupFolder.id)).status,
    STATUS_CODE.NotFound,
  );
});

Deno.test("PUT /api/forum/folders/{folderId}: a rename leaves the permission alone", async () => {
  const [operatorCookie, memberCookie] = await operatorAndMember();
  const folder = await (await create(operatorCookie, "Forenspiele", "read"))
    .json();

  assertEquals(
    (await request(
      "PUT",
      `/api/forum/folders/${folder.id}`,
      memberCookie,
      { title: "Meins", description: null },
    )).status,
    STATUS_CODE.Forbidden,
  );

  const renamed = await request(
    "PUT",
    `/api/forum/folders/${folder.id}`,
    operatorCookie,
    { title: "Spiele", description: "Reihum, ohne Ende." },
  );
  assertEquals(renamed.status, STATUS_CODE.OK);

  const updated = await renamed.json();
  assertEquals(updated.title, "Spiele");
  assertEquals(updated.description, "Reihum, ohne Ende.");
  assertEquals(updated.effectiveMemberPermission, "read");
});

Deno.test("PUT /api/forum/folders/{folderId}/parent: a move closes what it takes with it", async () => {
  const [operatorCookie] = await operatorAndMember();

  const open = await (await create(operatorCookie, "Forenspiele", "write"))
    .json();
  const closed = await (await create(operatorCookie, "Beendete Spiele", "read"))
    .json();
  const moving = await (await create(
    operatorCookie,
    "Wortkette",
    "write",
    open.id,
  )).json();

  const moved = await request(
    "PUT",
    `/api/forum/folders/${moving.id}/parent`,
    operatorCookie,
    { parentFolderId: closed.id },
  );
  assertEquals(moved.status, STATUS_CODE.OK);
  assertEquals((await moved.json()).effectiveMemberPermission, "read");

  // To the root, where its own setting answers again.
  const toRoot = await request(
    "PUT",
    `/api/forum/folders/${moving.id}/parent`,
    operatorCookie,
    { parentFolderId: null },
  );
  assertEquals((await toRoot.json()).effectiveMemberPermission, "write");
});

Deno.test("a folder cannot move into something it holds", async () => {
  const [operatorCookie] = await operatorAndMember();
  const top = await (await create(operatorCookie, "Forenspiele", "write"))
    .json();
  const inside = await (await create(
    operatorCookie,
    "Beendete Spiele",
    "write",
    top.id,
  )).json();

  const refused = await request(
    "PUT",
    `/api/forum/folders/${top.id}/parent`,
    operatorCookie,
    { parentFolderId: inside.id },
  );
  assertEquals(refused.status, STATUS_CODE.UnprocessableEntity);
  assertEquals((await refused.json()).code, "folder_cycle");
});

Deno.test(`a folder nests at most ${MAX_FOLDER_DEPTH} levels deep`, async () => {
  const [operatorCookie] = await operatorAndMember();

  let parentFolderId: string | undefined = undefined;
  for (let level = 1; level <= MAX_FOLDER_DEPTH; level++) {
    // deno-lint-ignore no-await-in-loop -- each level needs the one above it
    const response = await create(
      operatorCookie,
      `Ebene ${level}`,
      "write",
      parentFolderId,
    );
    assertEquals(response.status, STATUS_CODE.Created);
    // deno-lint-ignore no-await-in-loop -- as above
    const folder = await response.json();
    parentFolderId = folder.id;
  }

  const tooDeep = await create(
    operatorCookie,
    "Zu tief",
    "write",
    parentFolderId,
  );
  assertEquals(tooDeep.status, STATUS_CODE.UnprocessableEntity);
  assertEquals((await tooDeep.json()).code, "folder_too_deep");
});

Deno.test("DELETE /api/forum/folders/{folderId}: only an empty one goes", async () => {
  const [operatorCookie, memberCookie] = await operatorAndMember();
  const folder = await (await create(operatorCookie, "Forenspiele", "write"))
    .json();
  await createForumThread("Wortkette", "write", folder.id);

  assertEquals(
    (await request(
      "DELETE",
      `/api/forum/folders/${folder.id}`,
      memberCookie,
    )).status,
    STATUS_CODE.Forbidden,
  );

  const holding = await request(
    "DELETE",
    `/api/forum/folders/${folder.id}`,
    operatorCookie,
  );
  assertEquals(holding.status, STATUS_CODE.Conflict);
  assertEquals((await holding.json()).code, "folder_not_empty");

  const empty = await (await create(operatorCookie, "Leer", "write")).json();
  assertEquals(
    (await request("DELETE", `/api/forum/folders/${empty.id}`, operatorCookie))
      .status,
    STATUS_CODE.OK,
  );

  // Gone rather than emptied: the second attempt says which.
  assertEquals(
    (await request("DELETE", `/api/forum/folders/${empty.id}`, operatorCookie))
      .status,
    STATUS_CODE.NotFound,
  );
});
