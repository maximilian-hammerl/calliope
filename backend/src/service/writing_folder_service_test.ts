import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { type FolderId, type GroupId, mint } from "@/src/scope/scoped_id.ts";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
  write,
} from "@/src/test/support.ts";
import { WritingPageService } from "./writing_page_service.ts";
import {
  MAX_FOLDER_DEPTH,
  WritingFolderService,
} from "./writing_folder_service.ts";

// Scoped to this file, so a file running beside it cannot register or delete them.
const OWNER = "folder-service-owner";
const USERNAMES = [OWNER];

beforeEach(clearRateLimits);
afterEach(() => deleteUsers(USERNAMES));

async function aGroup() {
  const cookie = await registerUser(OWNER);
  const group = await createGroup(cookie, "Der Zauberzwerg");
  return {
    groupId: mint<GroupId>(group.id),
    ownerId: await getUserId(OWNER),
    cookie,
  };
}

/** Creating, with the outcome unwrapped — every test but the refusals expects a folder. */
async function make(
  groupId: GroupId,
  ownerId: string,
  title: string,
  parentFolderId: FolderId | null = null,
) {
  const outcome = await write((transaction) =>
    WritingFolderService.insertFolder(transaction, groupId, {
      title,
      description: null,
      parentFolderId,
    }, ownerId)
  );
  assert.equal(outcome.kind, "created");
  if (outcome.kind !== "created") throw new Error("unreachable");
  return { ...outcome.folder, id: mint<FolderId>(outcome.folder.id) };
}

test("a root folder is depth 1 and a child counts up from its parent", async () => {
  const { groupId, ownerId } = await aGroup();

  const root = await make(groupId, ownerId, "Weltenbau");
  const child = await make(groupId, ownerId, "Stadt A", root.id);

  assert.equal(root.depth, 1);
  assert.equal(root.parentFolderId, null);
  assert.equal(child.depth, 2);
  assert.equal(child.parentFolderId, root.id);
  assert.equal(root.createdByUsername, OWNER);
});

test("nesting stops at the maximum depth", async () => {
  const { groupId, ownerId } = await aGroup();

  // One chain down to the deepest level the member is allowed.
  let deepest = await make(groupId, ownerId, "Ebene 1");
  for (let level = 2; level <= MAX_FOLDER_DEPTH; level++) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose: each level needs the one above
    deepest = await make(groupId, ownerId, `Ebene ${level}`, deepest.id);
  }
  assert.equal(deepest.depth, MAX_FOLDER_DEPTH);

  const refused = await write((transaction) =>
    WritingFolderService.insertFolder(
      transaction,
      groupId,
      { title: "Zu tief", description: null, parentFolderId: deepest.id },
      ownerId,
    )
  );
  assert.equal(refused.kind, "tooDeep");
});

test("a parent in another group is not a parent", async () => {
  const { groupId, ownerId, cookie } = await aGroup();
  const elsewhere = await createGroup(cookie, "Andere Gruppe");
  const theirs = await make(mint(elsewhere.id), ownerId, "Fremder Ordner");

  const refused = await write((transaction) =>
    WritingFolderService.insertFolder(
      transaction,
      groupId,
      { title: "Kind", description: null, parentFolderId: theirs.id },
      ownerId,
    )
  );
  assert.equal(refused.kind, "noSuchParent");
});

test("folders are listed in creation order, scoped to their group", async () => {
  const { groupId, ownerId, cookie } = await aGroup();
  const elsewhere = await createGroup(cookie, "Andere Gruppe");

  const first = await make(groupId, ownerId, "Zuerst");
  const second = await make(groupId, ownerId, "Dann");
  await make(mint(elsewhere.id), ownerId, "Woanders");

  const folders = await WritingFolderService.listFolders(groupId);
  assert.deepEqual(folders.map((folder) => folder.id), [first.id, second.id]);
});

test("a title and a description can be changed", async () => {
  const { groupId, ownerId } = await aGroup();
  const folder = await make(groupId, ownerId, "Weltenbau");

  const updated = await write((transaction) =>
    WritingFolderService.updateFolder(
      transaction,
      groupId,
      folder.id,
      {
        title: "Welt",
        description: "Was in der Welt gilt.",
      },
    )
  );

  assert.equal(updated?.title, "Welt");
  assert.equal(updated?.description, "Was in der Welt gilt.");
  assert.equal(updated?.depth, 1);
});

test("an empty folder is deleted", async () => {
  const { groupId, ownerId } = await aGroup();
  const folder = await make(groupId, ownerId, "Leer");

  assert.equal(
    await write((transaction) =>
      WritingFolderService.deleteFolder(transaction, groupId, folder.id)
    ),
    "deleted",
  );
  assert.equal(
    await WritingFolderService.selectFolder(groupId, folder.id),
    undefined,
  );
});

test("a folder holding another folder is refused", async () => {
  const { groupId, ownerId } = await aGroup();
  const root = await make(groupId, ownerId, "Weltenbau");
  await make(groupId, ownerId, "Stadt A", root.id);

  assert.equal(
    await write((transaction) =>
      WritingFolderService.deleteFolder(transaction, groupId, root.id)
    ),
    "notEmpty",
  );
  assert.ok(await WritingFolderService.selectFolder(groupId, root.id));
});

test("a folder holding a page is refused", async () => {
  const { groupId, ownerId } = await aGroup();
  const folder = await make(groupId, ownerId, "Weltenbau");
  await write((transaction) =>
    WritingPageService.insertPage(
      transaction,
      groupId,
      "Die Bergstadt",
      plainTextToDocument("Ein Hafen im Norden."),
      ownerId,
      folder.id,
    )
  );

  assert.equal(
    await write((transaction) =>
      WritingFolderService.deleteFolder(transaction, groupId, folder.id)
    ),
    "notEmpty",
  );
});

test("a folder holding a thread is refused", async () => {
  const { groupId, ownerId } = await aGroup();
  const folder = await make(groupId, ownerId, "Weltenbau");
  await write((transaction) =>
    transaction
      .insertInto("writingThread")
      .values({
        writingGroupId: groupId,
        title: "Der lange Aufstieg",
        createdBy: ownerId,
        folderId: folder.id,
      })
      .execute()
  );

  assert.equal(
    await write((transaction) =>
      WritingFolderService.deleteFolder(transaction, groupId, folder.id)
    ),
    "notEmpty",
  );
});

/** A chain of folders, deepest last, so a subtree's height is easy to state in a test. */
async function chain(groupId: GroupId, ownerId: string, titles: string[]) {
  const made = [];
  let parent: FolderId | null = null;
  for (const title of titles) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose: each level needs the one above
    const folder = await make(groupId, ownerId, title, parent);
    made.push(folder);
    parent = folder.id;
  }
  return made;
}

test("moving a folder takes its subtree and rewrites every depth", async () => {
  const { groupId, ownerId } = await aGroup();
  const [weltenbau, stadt, viertel] = await chain(groupId, ownerId, [
    "Weltenbau",
    "Stadt A",
    "Viertel",
  ]);
  const figuren = await make(groupId, ownerId, "Figuren");
  assert.ok(weltenbau);
  assert.ok(stadt);
  assert.ok(viertel);

  // Stadt A carries Viertel with it, from depth 2 to depth 2 under Figuren — no change for
  // Stadt A itself, so the test moves it somewhere that does change the depths.
  const outcome = await write((transaction) =>
    WritingFolderService.moveFolder(transaction, groupId, stadt.id, figuren.id)
  );
  assert.equal(outcome?.kind, "moved");

  const byTitle = new Map(
    (await WritingFolderService.listFolders(groupId)).map((f) => [f.title, f]),
  );
  assert.equal(byTitle.get("Stadt A")?.parentFolderId, figuren.id);
  assert.equal(byTitle.get("Stadt A")?.depth, 2);
  // The descendant moved with it and kept its distance.
  assert.equal(byTitle.get("Viertel")?.parentFolderId, stadt.id);
  assert.equal(byTitle.get("Viertel")?.depth, 3);
  assert.equal(byTitle.get("Weltenbau")?.depth, 1);
});

test("a folder moved to the root sits at depth 1 with its subtree behind it", async () => {
  const { groupId, ownerId } = await aGroup();
  const [, stadt, viertel] = await chain(groupId, ownerId, [
    "Weltenbau",
    "Stadt A",
    "Viertel",
  ]);
  assert.ok(stadt);
  assert.ok(viertel);

  assert.equal(
    (await write((transaction) =>
      WritingFolderService.moveFolder(
        transaction,
        groupId,
        stadt.id,
        null,
      )
    ))?.kind,
    "moved",
  );

  const byTitle = new Map(
    (await WritingFolderService.listFolders(groupId)).map((f) => [f.title, f]),
  );
  assert.equal(byTitle.get("Stadt A")?.parentFolderId, null);
  assert.equal(byTitle.get("Stadt A")?.depth, 1);
  assert.equal(byTitle.get("Viertel")?.depth, 2);
});

test("a folder cannot move into itself", async () => {
  const { groupId, ownerId } = await aGroup();
  const folder = await make(groupId, ownerId, "Weltenbau");

  const outcome = await write((transaction) =>
    WritingFolderService.moveFolder(
      transaction,
      groupId,
      folder.id,
      folder.id,
    )
  );
  assert.equal(outcome?.kind, "cycle");
});

test("a folder cannot move into something it holds, however deep", async () => {
  const { groupId, ownerId } = await aGroup();
  const [weltenbau, , viertel] = await chain(groupId, ownerId, [
    "Weltenbau",
    "Stadt A",
    "Viertel",
  ]);
  assert.ok(weltenbau);
  assert.ok(viertel);

  // Two levels down, so the check has to walk rather than compare the parent.
  const outcome = await write((transaction) =>
    WritingFolderService.moveFolder(
      transaction,
      groupId,
      weltenbau.id,
      viertel.id,
    )
  );
  assert.equal(outcome?.kind, "cycle");

  // And nothing moved.
  const byTitle = new Map(
    (await WritingFolderService.listFolders(groupId)).map((f) => [f.title, f]),
  );
  assert.equal(byTitle.get("Weltenbau")?.parentFolderId, null);
  assert.equal(byTitle.get("Viertel")?.depth, 3);
});

test("the refusal is about the deepest descendant, not the folder", async () => {
  const { groupId, ownerId } = await aGroup();
  // A subtree three levels tall, and somewhere four levels down to put it.
  const [top, , ,] = await chain(groupId, ownerId, ["Oben", "Mitte", "Unten"]);
  const [, , , tief] = await chain(groupId, ownerId, ["E1", "E2", "E3", "E4"]);
  assert.ok(top);
  assert.ok(tief);

  // `top` alone would land at 5, which is allowed — its subtree would reach 7, which is not.
  assert.equal(tief.depth, 4);
  const refused = await write((transaction) =>
    WritingFolderService.moveFolder(
      transaction,
      groupId,
      top.id,
      tief.id,
    )
  );
  assert.equal(refused?.kind, "tooDeep");

  // One level higher there is room for exactly the three of them.
  const room = await WritingFolderService.listFolders(groupId);
  const e2 = room.find((f) => f.title === "E2");
  assert.ok(e2);
  assert.equal(
    (await write((transaction) =>
      WritingFolderService.moveFolder(
        transaction,
        groupId,
        top.id,
        mint(e2.id),
      )
    ))
      ?.kind,
    "moved",
  );
  const after = await WritingFolderService.listFolders(groupId);
  assert.equal(after.find((f) => f.title === "Unten")?.depth, MAX_FOLDER_DEPTH);
});

test("moving a folder that is not in the group answers nothing", async () => {
  const { groupId, ownerId, cookie } = await aGroup();
  const elsewhere = await createGroup(cookie, "Andere Gruppe");
  const theirs = await make(mint(elsewhere.id), ownerId, "Fremd");

  assert.equal(
    await write((transaction) =>
      WritingFolderService.moveFolder(
        transaction,
        groupId,
        theirs.id,
        null,
      )
    ),
    undefined,
  );
});

test("a target in another group is not a target", async () => {
  const { groupId, ownerId, cookie } = await aGroup();
  const elsewhere = await createGroup(cookie, "Andere Gruppe");
  const theirs = await make(mint(elsewhere.id), ownerId, "Fremd");
  const ours = await make(groupId, ownerId, "Weltenbau");

  const outcome = await write((transaction) =>
    WritingFolderService.moveFolder(
      transaction,
      groupId,
      ours.id,
      theirs.id,
    )
  );
  assert.equal(outcome?.kind, "noSuchParent");
});

test("deleting a folder that is not there says so, rather than blaming its contents", async () => {
  const { groupId, ownerId, cookie } = await aGroup();
  const elsewhere = await createGroup(cookie, "Andere Gruppe");
  const theirs = await make(mint(elsewhere.id), ownerId, "Fremd");

  // Never existed here, and existing-but-elsewhere: both are "no such folder in this group",
  // and neither is a claim that it still holds something.
  assert.equal(
    await write((transaction) =>
      WritingFolderService.deleteFolder(
        transaction,
        groupId,
        mint("01a00000-0000-7000-8000-00000000ffff"),
      )
    ),
    undefined,
  );
  assert.equal(
    await write((transaction) =>
      WritingFolderService.deleteFolder(transaction, groupId, theirs.id)
    ),
    undefined,
  );

  // And the one it is really about still answers `notEmpty`.
  const root = await make(groupId, ownerId, "Weltenbau");
  await make(groupId, ownerId, "Stadt A", root.id);
  assert.equal(
    await write((transaction) =>
      WritingFolderService.deleteFolder(transaction, groupId, root.id)
    ),
    "notEmpty",
  );
});
