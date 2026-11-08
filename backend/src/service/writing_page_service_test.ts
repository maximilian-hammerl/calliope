import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { type GroupId, mint, type PageId } from "#/src/scope/scoped_id.ts";
import { plainTextToDocument } from "#/src/document/document_text.ts";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
  write,
} from "#/src/test/support.ts";
import { WritingPageService } from "./writing_page_service.ts";

// Scoped to this file, so a file running beside it cannot register or delete them.
const OWNER = "page-service-owner";
const OTHER = "page-service-other";
const USERNAMES = [OWNER, OTHER];

beforeEach(clearRateLimits);
afterEach(() => deleteUsers(USERNAMES));

/** A group with one page in it, and the ids of both members. */
async function groupWithPage(title = "Weltenbau") {
  const cookie = await registerUser(OWNER);
  const other = await registerUser(OTHER);
  const group = await createGroup(cookie, "Der Zauberzwerg");
  const groupId = mint<GroupId>(group.id);
  const authorId = await getUserId(OWNER);
  const otherId = await getUserId(OTHER);

  const page = await write((transaction) =>
    WritingPageService.insertPage(
      transaction,
      groupId,
      title,
      plainTextToDocument("Der Berg ist hoch."),
      authorId,
    ),
  );
  return {
    groupId,
    page: { ...page, id: mint<PageId>(page.id) },
    authorId,
    otherId,
    cookie,
    other,
  };
}

test("a page carries its author, its editor and the prose of its document", async () => {
  const { page } = await groupWithPage();

  assert.equal(page.title, "Weltenbau");
  assert.equal(page.createdByUsername, OWNER);
  // The creator counts as the first editor, so a refusal can always name somebody.
  assert.equal(page.updatedByUsername, OWNER);
  assert.equal(page.document.type, "doc");
});

test("a page is scoped to its group", async () => {
  const { groupId, page, cookie } = await groupWithPage();
  const otherGroup = await createGroup(cookie, "Die Verwandtschaft");

  assert.ok(await WritingPageService.selectPage(groupId, page.id));
  assert.equal(await WritingPageService.selectPage(mint(otherGroup.id), page.id), undefined);
});

test("an edit against the loaded time is written", async () => {
  const { groupId, page, authorId } = await groupWithPage();

  const outcome = await write((transaction) =>
    WritingPageService.updatePage(
      transaction,
      groupId,
      page.id,
      page.lastActivityAt,
      {
        title: "Weltenbau",
        document: plainTextToDocument("Der Berg ist steil."),
      },
      authorId,
    ),
  );

  assert.equal(outcome?.kind, "updated");
  // The trigger moved it on, which is what the next editor will be checked against.
  assert.notEqual(outcome?.page.lastActivityAt, page.lastActivityAt);
});

/**
 * The point of the whole mechanism: the second editor loaded the page before the first one
 * saved, and their write is refused rather than quietly replacing it.
 */
test("an edit against a time that has moved on is refused", async () => {
  const { groupId, page, authorId, otherId } = await groupWithPage();
  const loadedByBoth = page.lastActivityAt;

  const first = await write((transaction) =>
    WritingPageService.updatePage(
      transaction,
      groupId,
      page.id,
      loadedByBoth,
      {
        title: "Weltenbau",
        document: plainTextToDocument("Die erste Fassung."),
      },
      authorId,
    ),
  );
  assert.equal(first?.kind, "updated");

  const second = await write((transaction) =>
    WritingPageService.updatePage(
      transaction,
      groupId,
      page.id,
      loadedByBoth,
      {
        title: "Weltenbau",
        document: plainTextToDocument("Die zweite Fassung."),
      },
      otherId,
    ),
  );

  assert.equal(second?.kind, "stale");
  // And it says whose work would have been overwritten, for the message.
  assert.equal(second?.page.updatedByUsername, OWNER);
  // The first version stands.
  const stored = await WritingPageService.selectPage(groupId, page.id);
  assert.deepEqual(stored?.document, first?.page.document);
});

test("updating a page that is not in the group answers nothing", async () => {
  const { page, cookie } = await groupWithPage();
  const otherGroup = await createGroup(cookie, "Effi Briefe");

  assert.equal(
    await write(async (transaction) =>
      WritingPageService.updatePage(
        transaction,
        mint(otherGroup.id),
        page.id,
        page.lastActivityAt,
        { title: "x", document: plainTextToDocument("x") },
        await getUserId(OWNER),
      ),
    ),
    undefined,
  );
});

test("a deleted page is gone", async () => {
  const { groupId, page, authorId } = await groupWithPage();

  await write((transaction) => WritingPageService.deletePage(transaction, groupId, page.id));

  assert.equal(await WritingPageService.selectPage(groupId, page.id), undefined);
  assert.deepEqual(await WritingPageService.listPages(groupId, authorId), []);
});

test("pages are listed by activity, and ties by id", async () => {
  const { groupId, authorId } = await groupWithPage("Zuerst");

  // Written in one statement, so all three share a timestamp — which is what the seed does and
  // what makes the tiebreaker the ordinary case rather than an edge.
  await write((transaction) =>
    transaction
      .insertInto("writingPage")
      .values(
        ["Zweitens", "Drittens"].map((title) => ({
          writingGroupId: groupId,
          title,
          document: plainTextToDocument(title),
          text: title,
          createdBy: authorId,
          updatedBy: authorId,
        })),
      )
      .execute(),
  );

  const listed = await WritingPageService.listPages(groupId, authorId);
  const tied = listed.filter((page) => page.title !== "Zuerst");
  assert.equal(tied.length, 2);
  assert.equal(
    tied[0]?.lastActivityAt,
    tied[1]?.lastActivityAt,
    "the two written together should tie",
  );

  // Newest id first, and the same on every call.
  assert.deepEqual(
    tied.map((page) => page.id),
    tied
      .map((page) => page.id)
      .sort()
      .reverse(),
  );
  const again = await WritingPageService.listPages(groupId, authorId);
  assert.deepEqual(
    again.map((page) => page.id),
    listed.map((page) => page.id),
  );
});
