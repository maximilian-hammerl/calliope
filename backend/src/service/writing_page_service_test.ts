import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
} from "@/src/test/support.ts";
import { WritingPageService } from "./writing_page_service.ts";

// Scoped to this file, so a file running beside it cannot register or delete them.
const OWNER = "page-service-owner";
const OTHER = "page-service-other";
const USERNAMES = [OWNER, OTHER];

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers(USERNAMES));

/** A group with one page in it, and the ids of both members. */
async function groupWithPage(title = "Weltenbau") {
  const cookie = await registerUser(OWNER);
  const other = await registerUser(OTHER);
  const group = await createGroup(cookie, "Der Zauberzwerg");
  const authorId = await getUserId(OWNER);
  const otherId = await getUserId(OTHER);

  const page = await WritingPageService.insertPage(
    group.id,
    title,
    plainTextToDocument("Der Berg ist hoch."),
    authorId,
  );
  return { groupId: group.id, page, authorId, otherId, cookie, other };
}

Deno.test("a page carries its author, its editor and the prose of its document", async () => {
  const { page } = await groupWithPage();

  assertEquals(page.title, "Weltenbau");
  assertEquals(page.createdByUsername, OWNER);
  // The creator counts as the first editor, so a refusal can always name somebody.
  assertEquals(page.updatedByUsername, OWNER);
  assertEquals(page.document.type, "doc");
});

Deno.test("a page is scoped to its group", async () => {
  const { groupId, page, cookie } = await groupWithPage();
  const otherGroup = await createGroup(cookie, "Die Verwandtschaft");

  assertExists(await WritingPageService.selectPage(groupId, page.id));
  assertEquals(
    await WritingPageService.selectPage(otherGroup.id, page.id),
    undefined,
  );
});

Deno.test("an edit against the loaded time is written", async () => {
  const { groupId, page, authorId } = await groupWithPage();

  const outcome = await WritingPageService.updatePage(
    groupId,
    page.id,
    page.lastActivityAt,
    {
      title: "Weltenbau",
      document: plainTextToDocument("Der Berg ist steil."),
    },
    authorId,
  );

  assertEquals(outcome?.kind, "updated");
  // The trigger moved it on, which is what the next editor will be checked against.
  assertNotEquals(outcome?.page.lastActivityAt, page.lastActivityAt);
});

/**
 * The point of the whole mechanism: the second editor loaded the page before the first one
 * saved, and their write is refused rather than quietly replacing it.
 */
Deno.test("an edit against a time that has moved on is refused", async () => {
  const { groupId, page, authorId, otherId } = await groupWithPage();
  const loadedByBoth = page.lastActivityAt;

  const first = await WritingPageService.updatePage(
    groupId,
    page.id,
    loadedByBoth,
    { title: "Weltenbau", document: plainTextToDocument("Die erste Fassung.") },
    authorId,
  );
  assertEquals(first?.kind, "updated");

  const second = await WritingPageService.updatePage(
    groupId,
    page.id,
    loadedByBoth,
    {
      title: "Weltenbau",
      document: plainTextToDocument("Die zweite Fassung."),
    },
    otherId,
  );

  assertEquals(second?.kind, "stale");
  // And it says whose work would have been overwritten, for the message.
  assertEquals(second?.page.updatedByUsername, OWNER);
  // The first version stands.
  const stored = await WritingPageService.selectPage(groupId, page.id);
  assertEquals(stored?.document, first?.page.document);
});

Deno.test("updating a page that is not in the group answers nothing", async () => {
  const { page, cookie } = await groupWithPage();
  const otherGroup = await createGroup(cookie, "Effi Briefe");

  assertEquals(
    await WritingPageService.updatePage(
      otherGroup.id,
      page.id,
      page.lastActivityAt,
      { title: "x", document: plainTextToDocument("x") },
      await getUserId(OWNER),
    ),
    undefined,
  );
});

Deno.test("a deleted page is gone", async () => {
  const { groupId, page, authorId } = await groupWithPage();

  await WritingPageService.deletePage(groupId, page.id);

  assertEquals(
    await WritingPageService.selectPage(groupId, page.id),
    undefined,
  );
  assertEquals(await WritingPageService.listPages(groupId, authorId), []);
});
