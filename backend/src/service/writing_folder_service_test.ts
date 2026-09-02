import { assertEquals, assertExists } from "@std/assert";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import { db } from "@/src/database/client.ts";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
} from "@/src/test/support.ts";
import { WritingPageService } from "./writing_page_service.ts";
import {
  MAX_FOLDER_DEPTH,
  WritingFolderService,
} from "./writing_folder_service.ts";

// Scoped to this file, so a file running beside it cannot register or delete them.
const OWNER = "folder-service-owner";
const USERNAMES = [OWNER];

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers(USERNAMES));

async function aGroup() {
  const cookie = await registerUser(OWNER);
  const group = await createGroup(cookie, "Der Zauberzwerg");
  return { groupId: group.id, ownerId: await getUserId(OWNER), cookie };
}

/** Creating, with the outcome unwrapped — every test but the refusals expects a folder. */
async function make(
  groupId: string,
  ownerId: string,
  title: string,
  parentFolderId: string | null = null,
) {
  const outcome = await WritingFolderService.insertFolder(
    groupId,
    { title, description: null, parentFolderId },
    ownerId,
  );
  assertEquals(outcome.kind, "created");
  if (outcome.kind !== "created") throw new Error("unreachable");
  return outcome.folder;
}

Deno.test("a root folder is depth 1 and a child counts up from its parent", async () => {
  const { groupId, ownerId } = await aGroup();

  const root = await make(groupId, ownerId, "Weltenbau");
  const child = await make(groupId, ownerId, "Stadt A", root.id);

  assertEquals(root.depth, 1);
  assertEquals(root.parentFolderId, null);
  assertEquals(child.depth, 2);
  assertEquals(child.parentFolderId, root.id);
  assertEquals(root.createdByUsername, OWNER);
});

Deno.test("nesting stops at the maximum depth", async () => {
  const { groupId, ownerId } = await aGroup();

  // One chain down to the deepest level the member is allowed.
  let deepest = await make(groupId, ownerId, "Ebene 1");
  for (let level = 2; level <= MAX_FOLDER_DEPTH; level++) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose: each level needs the one above
    deepest = await make(groupId, ownerId, `Ebene ${level}`, deepest.id);
  }
  assertEquals(deepest.depth, MAX_FOLDER_DEPTH);

  const refused = await WritingFolderService.insertFolder(
    groupId,
    { title: "Zu tief", description: null, parentFolderId: deepest.id },
    ownerId,
  );
  assertEquals(refused.kind, "tooDeep");
});

Deno.test("a parent in another group is not a parent", async () => {
  const { groupId, ownerId, cookie } = await aGroup();
  const elsewhere = await createGroup(cookie, "Andere Gruppe");
  const theirs = await make(elsewhere.id, ownerId, "Fremder Ordner");

  const refused = await WritingFolderService.insertFolder(
    groupId,
    { title: "Kind", description: null, parentFolderId: theirs.id },
    ownerId,
  );
  assertEquals(refused.kind, "noSuchParent");
});

Deno.test("folders are listed in creation order, scoped to their group", async () => {
  const { groupId, ownerId, cookie } = await aGroup();
  const elsewhere = await createGroup(cookie, "Andere Gruppe");

  const first = await make(groupId, ownerId, "Zuerst");
  const second = await make(groupId, ownerId, "Dann");
  await make(elsewhere.id, ownerId, "Woanders");

  const folders = await WritingFolderService.listFolders(groupId);
  assertEquals(folders.map((folder) => folder.id), [first.id, second.id]);
});

Deno.test("a title and a description can be changed", async () => {
  const { groupId, ownerId } = await aGroup();
  const folder = await make(groupId, ownerId, "Weltenbau");

  const updated = await WritingFolderService.updateFolder(groupId, folder.id, {
    title: "Welt",
    description: "Was in der Welt gilt.",
  });

  assertEquals(updated?.title, "Welt");
  assertEquals(updated?.description, "Was in der Welt gilt.");
  assertEquals(updated?.depth, 1);
});

Deno.test("an empty folder is deleted", async () => {
  const { groupId, ownerId } = await aGroup();
  const folder = await make(groupId, ownerId, "Leer");

  assertEquals(
    await WritingFolderService.deleteFolder(groupId, folder.id),
    "deleted",
  );
  assertEquals(
    await WritingFolderService.selectFolder(groupId, folder.id),
    undefined,
  );
});

Deno.test("a folder holding another folder is refused", async () => {
  const { groupId, ownerId } = await aGroup();
  const root = await make(groupId, ownerId, "Weltenbau");
  await make(groupId, ownerId, "Stadt A", root.id);

  assertEquals(
    await WritingFolderService.deleteFolder(groupId, root.id),
    "notEmpty",
  );
  assertExists(await WritingFolderService.selectFolder(groupId, root.id));
});

Deno.test("a folder holding a page is refused", async () => {
  const { groupId, ownerId } = await aGroup();
  const folder = await make(groupId, ownerId, "Weltenbau");
  await WritingPageService.insertPage(
    groupId,
    "Die Bergstadt",
    plainTextToDocument("Ein Hafen im Norden."),
    ownerId,
    folder.id,
  );

  assertEquals(
    await WritingFolderService.deleteFolder(groupId, folder.id),
    "notEmpty",
  );
});

Deno.test("a folder holding a thread is refused", async () => {
  const { groupId, ownerId } = await aGroup();
  const folder = await make(groupId, ownerId, "Weltenbau");
  await db
    .insertInto("writingThread")
    .values({
      writingGroupId: groupId,
      title: "Der lange Aufstieg",
      createdBy: ownerId,
      folderId: folder.id,
    })
    .execute();

  assertEquals(
    await WritingFolderService.deleteFolder(groupId, folder.id),
    "notEmpty",
  );
});

/** A chain of folders, deepest last, so a subtree's height is easy to state in a test. */
async function chain(groupId: string, ownerId: string, titles: string[]) {
  const made = [];
  let parent: string | null = null;
  for (const title of titles) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose: each level needs the one above
    const folder = await make(groupId, ownerId, title, parent);
    made.push(folder);
    parent = folder.id;
  }
  return made;
}

Deno.test("moving a folder takes its subtree and rewrites every depth", async () => {
  const { groupId, ownerId } = await aGroup();
  const [weltenbau, stadt, viertel] = await chain(groupId, ownerId, [
    "Weltenbau",
    "Stadt A",
    "Viertel",
  ]);
  const figuren = await make(groupId, ownerId, "Figuren");
  assertExists(weltenbau);
  assertExists(stadt);
  assertExists(viertel);

  // Stadt A carries Viertel with it, from depth 2 to depth 2 under Figuren — no change for
  // Stadt A itself, so the test moves it somewhere that does change the depths.
  const outcome = await WritingFolderService.moveFolder(
    groupId,
    stadt.id,
    figuren.id,
  );
  assertEquals(outcome?.kind, "moved");

  const byTitle = new Map(
    (await WritingFolderService.listFolders(groupId)).map((f) => [f.title, f]),
  );
  assertEquals(byTitle.get("Stadt A")?.parentFolderId, figuren.id);
  assertEquals(byTitle.get("Stadt A")?.depth, 2);
  // The descendant moved with it and kept its distance.
  assertEquals(byTitle.get("Viertel")?.parentFolderId, stadt.id);
  assertEquals(byTitle.get("Viertel")?.depth, 3);
  assertEquals(byTitle.get("Weltenbau")?.depth, 1);
});

Deno.test("a folder moved to the root sits at depth 1 with its subtree behind it", async () => {
  const { groupId, ownerId } = await aGroup();
  const [, stadt, viertel] = await chain(groupId, ownerId, [
    "Weltenbau",
    "Stadt A",
    "Viertel",
  ]);
  assertExists(stadt);
  assertExists(viertel);

  assertEquals(
    (await WritingFolderService.moveFolder(groupId, stadt.id, null))?.kind,
    "moved",
  );

  const byTitle = new Map(
    (await WritingFolderService.listFolders(groupId)).map((f) => [f.title, f]),
  );
  assertEquals(byTitle.get("Stadt A")?.parentFolderId, null);
  assertEquals(byTitle.get("Stadt A")?.depth, 1);
  assertEquals(byTitle.get("Viertel")?.depth, 2);
});

Deno.test("a folder cannot move into itself", async () => {
  const { groupId, ownerId } = await aGroup();
  const folder = await make(groupId, ownerId, "Weltenbau");

  const outcome = await WritingFolderService.moveFolder(
    groupId,
    folder.id,
    folder.id,
  );
  assertEquals(outcome?.kind, "cycle");
});

Deno.test("a folder cannot move into something it holds, however deep", async () => {
  const { groupId, ownerId } = await aGroup();
  const [weltenbau, , viertel] = await chain(groupId, ownerId, [
    "Weltenbau",
    "Stadt A",
    "Viertel",
  ]);
  assertExists(weltenbau);
  assertExists(viertel);

  // Two levels down, so the check has to walk rather than compare the parent.
  const outcome = await WritingFolderService.moveFolder(
    groupId,
    weltenbau.id,
    viertel.id,
  );
  assertEquals(outcome?.kind, "cycle");

  // And nothing moved.
  const byTitle = new Map(
    (await WritingFolderService.listFolders(groupId)).map((f) => [f.title, f]),
  );
  assertEquals(byTitle.get("Weltenbau")?.parentFolderId, null);
  assertEquals(byTitle.get("Viertel")?.depth, 3);
});

Deno.test("the refusal is about the deepest descendant, not the folder", async () => {
  const { groupId, ownerId } = await aGroup();
  // A subtree three levels tall, and somewhere four levels down to put it.
  const [top, , ,] = await chain(groupId, ownerId, ["Oben", "Mitte", "Unten"]);
  const [, , , tief] = await chain(groupId, ownerId, ["E1", "E2", "E3", "E4"]);
  assertExists(top);
  assertExists(tief);

  // `top` alone would land at 5, which is allowed — its subtree would reach 7, which is not.
  assertEquals(tief.depth, 4);
  const refused = await WritingFolderService.moveFolder(
    groupId,
    top.id,
    tief.id,
  );
  assertEquals(refused?.kind, "tooDeep");

  // One level higher there is room for exactly the three of them.
  const room = await WritingFolderService.listFolders(groupId);
  const e2 = room.find((f) => f.title === "E2");
  assertExists(e2);
  assertEquals(
    (await WritingFolderService.moveFolder(groupId, top.id, e2.id))?.kind,
    "moved",
  );
  const after = await WritingFolderService.listFolders(groupId);
  assertEquals(after.find((f) => f.title === "Unten")?.depth, MAX_FOLDER_DEPTH);
});

Deno.test("moving a folder that is not in the group answers nothing", async () => {
  const { groupId, ownerId, cookie } = await aGroup();
  const elsewhere = await createGroup(cookie, "Andere Gruppe");
  const theirs = await make(elsewhere.id, ownerId, "Fremd");

  assertEquals(
    await WritingFolderService.moveFolder(groupId, theirs.id, null),
    undefined,
  );
});

Deno.test("a target in another group is not a target", async () => {
  const { groupId, ownerId, cookie } = await aGroup();
  const elsewhere = await createGroup(cookie, "Andere Gruppe");
  const theirs = await make(elsewhere.id, ownerId, "Fremd");
  const ours = await make(groupId, ownerId, "Weltenbau");

  const outcome = await WritingFolderService.moveFolder(
    groupId,
    ours.id,
    theirs.id,
  );
  assertEquals(outcome?.kind, "noSuchParent");
});

Deno.test("deleting a folder that is not there says so, rather than blaming its contents", async () => {
  const { groupId, ownerId, cookie } = await aGroup();
  const elsewhere = await createGroup(cookie, "Andere Gruppe");
  const theirs = await make(elsewhere.id, ownerId, "Fremd");

  // Never existed here, and existing-but-elsewhere: both are "no such folder in this group",
  // and neither is a claim that it still holds something.
  assertEquals(
    await WritingFolderService.deleteFolder(
      groupId,
      "01a00000-0000-7000-8000-00000000ffff",
    ),
    undefined,
  );
  assertEquals(
    await WritingFolderService.deleteFolder(groupId, theirs.id),
    undefined,
  );

  // And the one it is really about still answers `notEmpty`.
  const root = await make(groupId, ownerId, "Weltenbau");
  await make(groupId, ownerId, "Stadt A", root.id);
  assertEquals(
    await WritingFolderService.deleteFolder(groupId, root.id),
    "notEmpty",
  );
});
