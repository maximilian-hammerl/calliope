import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import { PAGE_CHANGED } from "@/src/http/response.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";

const administrator = "pages-test-admin";
const writer = "pages-test-writer";
const reader = "pages-test-reader";
const stranger = "pages-test-stranger";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([administrator, writer, reader, stranger]));

/** What the frontend's `emptyDocument()` sends: a document may not be empty, a paragraph may. */
const EMPTY_DOCUMENT = { type: "doc", content: [{ type: "paragraph" }] };

function pageBody(title: string, text: string, loadedAt?: string) {
  return { title, document: plainTextToDocument(text), loadedAt };
}

async function groupWithPage(adminCookie: string) {
  const group = await createGroup(adminCookie, "Weltenbau");
  const created = await request(
    "POST",
    `/api/groups/${group.id}/pages`,
    adminCookie,
    pageBody("Stadt A", "Ein Hafen im Norden."),
  );
  assert.equal(created.status, STATUS_CODE.Created);
  return { group, page: await created.json() };
}

test("POST /api/groups/{groupId}/pages adds a page with its author and prose", async () => {
  const adminCookie = await registerUser(administrator);
  const { page } = await groupWithPage(adminCookie);

  assert.equal(page.title, "Stadt A");
  assert.equal(page.document.type, "doc");
  assert.equal(page.createdByUsername, administrator);
  // The creator counts as the first editor, so a refusal can name somebody from the start.
  assert.equal(page.updatedByUsername, administrator);
});

test("POST /api/groups/{groupId}/pages refuses a reader with 403", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request(
    "POST",
    `/api/groups/${group.id}/pages`,
    readerCookie,
    pageBody("Stadt A", "Sollte nicht gehen"),
  );

  // 403, not 404: the reader can see the group, so its existence is no secret.
  assert.equal(response.status, STATUS_CODE.Forbidden);
});

test("POST /api/groups/{groupId}/pages accepts a page with an empty body", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");

  // How a page is made: the title is asked for, and the body is written afterwards.
  const response = await request(
    "POST",
    `/api/groups/${group.id}/pages`,
    adminCookie,
    { title: "Stadt A", document: EMPTY_DOCUMENT },
  );

  assert.equal(response.status, STATUS_CODE.Created);
  assert.equal((await response.json()).title, "Stadt A");
});

test("POST /api/groups/{groupId}/pages refuses prose over the limit", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");

  const response = await request(
    "POST",
    `/api/groups/${group.id}/pages`,
    adminCookie,
    pageBody("Zu lang", "a".repeat(TEXT_LIMIT.documentText + 1)),
  );

  assert.equal(response.status, STATUS_CODE.BadRequest);
});

test("GET /api/groups/{groupId}/pages lists titles without their prose", async () => {
  const adminCookie = await registerUser(administrator);
  const { group } = await groupWithPage(adminCookie);
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request(
    "GET",
    `/api/groups/${group.id}/pages`,
    readerCookie,
  );

  assert.equal(response.status, STATUS_CODE.OK);
  const { results } = await response.json();
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Stadt A");
  // The rail lists a group; sending every document would make that a bulk download.
  assert.ok(!("document" in results[0]));
  assert.ok(!("text" in results[0]));
});

test("GET /api/groups/{groupId}/pages answers 404 for a stranger to a private group", async () => {
  const adminCookie = await registerUser(administrator);
  const { group } = await groupWithPage(adminCookie);
  const strangerCookie = await registerUser(stranger);

  const response = await request(
    "GET",
    `/api/groups/${group.id}/pages`,
    strangerCookie,
  );

  assert.equal(response.status, STATUS_CODE.NotFound);
});

test("GET /api/groups/{groupId}/pages/{pageId} answers with the prose", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, page } = await groupWithPage(adminCookie);

  const response = await request(
    "GET",
    `/api/groups/${group.id}/pages/${page.id}`,
    adminCookie,
  );

  assert.equal(response.status, STATUS_CODE.OK);
  const read = await response.json();
  assert.equal(
    read.document.content[0].content[0].text,
    "Ein Hafen im Norden.",
  );
  assert.equal(read.lastActivityAt, page.lastActivityAt);
});

test("GET /api/groups/{groupId}/pages/{pageId} answers 404 for a page of another group", async () => {
  const adminCookie = await registerUser(administrator);
  const { page } = await groupWithPage(adminCookie);
  const other = await createGroup(adminCookie, "Andere Gruppe");

  const response = await request(
    "GET",
    `/api/groups/${other.id}/pages/${page.id}`,
    adminCookie,
  );

  assert.equal(response.status, STATUS_CODE.NotFound);
});

test("PUT /api/groups/{groupId}/pages/{pageId} saves against the time it was loaded", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, page } = await groupWithPage(adminCookie);

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/pages/${page.id}`,
    adminCookie,
    pageBody(
      "Stadt A am Meer",
      "Ein Hafen weit im Norden.",
      page.lastActivityAt,
    ),
  );

  // Also proves the timestamp survives the round trip: it is compared for equality, and a
  // conversion through `Date` would drop the microseconds and refuse every save as stale.
  assert.equal(response.status, STATUS_CODE.OK);
  const saved = await response.json();
  assert.equal(saved.title, "Stadt A am Meer");
  assert.equal(saved.updatedByUsername, administrator);
});

test("PUT /api/groups/{groupId}/pages/{pageId} refuses a save against a time that has moved on", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, page } = await groupWithPage(adminCookie);
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");
  const loadedByBoth = page.lastActivityAt;

  const first = await request(
    "PUT",
    `/api/groups/${group.id}/pages/${page.id}`,
    adminCookie,
    pageBody("Stadt A", "Die erste Fassung.", loadedByBoth),
  );
  assert.equal(first.status, STATUS_CODE.OK);

  // An administrator, so this is refused for staleness and not for authorisation.
  const second = await request(
    "PUT",
    `/api/groups/${group.id}/pages/${page.id}`,
    await addMember(adminCookie, group.id, stranger, "administrator"),
    pageBody("Stadt A", "Die zweite Fassung.", loadedByBoth),
  );

  assert.equal(second.status, STATUS_CODE.Conflict);
  const refusal = await second.json();
  assert.equal(refusal.code, PAGE_CHANGED);
  assert.equal(refusal.updatedByUsername, administrator);

  // The first version stands: a refused save writes nothing.
  const read = await request(
    "GET",
    `/api/groups/${group.id}/pages/${page.id}`,
    writerCookie,
  );
  assert.equal(
    (await read.json()).document.content[0].content[0].text,
    "Die erste Fassung.",
  );
});

test("PUT /api/groups/{groupId}/pages/{pageId} lets any writer save it", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, page } = await groupWithPage(adminCookie);
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/pages/${page.id}`,
    writerCookie,
    pageBody("Stadt A", "Fremde Fassung.", page.lastActivityAt),
  );

  // A page is material the group keeps, not writing that belongs to whoever typed it first.
  assert.equal(response.status, STATUS_CODE.OK);
  assert.equal((await response.json()).updatedByUsername, writer);
});

test("PUT /api/groups/{groupId}/pages/{pageId} still refuses a reader", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, page } = await groupWithPage(adminCookie);
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/pages/${page.id}`,
    readerCookie,
    pageBody("Stadt A", "Sollte nicht gehen.", page.lastActivityAt),
  );

  assert.equal(response.status, STATUS_CODE.Forbidden);
});

test("DELETE /api/groups/{groupId}/pages/{pageId} removes it for its author", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, page } = await groupWithPage(adminCookie);

  const deleted = await request(
    "DELETE",
    `/api/groups/${group.id}/pages/${page.id}`,
    adminCookie,
  );
  assert.equal(deleted.status, STATUS_CODE.OK);

  const read = await request(
    "GET",
    `/api/groups/${group.id}/pages/${page.id}`,
    adminCookie,
  );
  assert.equal(read.status, STATUS_CODE.NotFound);
});

test("DELETE /api/groups/{groupId}/pages/{pageId} lets any writer delete it", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, page } = await groupWithPage(adminCookie);
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/pages/${page.id}`,
    writerCookie,
  );
  assert.equal(response.status, STATUS_CODE.OK);

  const read = await request(
    "GET",
    `/api/groups/${group.id}/pages/${page.id}`,
    adminCookie,
  );
  assert.equal(read.status, STATUS_CODE.NotFound);
});

test("DELETE /api/groups/{groupId}/pages/{pageId} still refuses a reader", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, page } = await groupWithPage(adminCookie);
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/pages/${page.id}`,
    readerCookie,
  );

  assert.equal(response.status, STATUS_CODE.Forbidden);
});

test("PUT /pages/{pageId}/folder moves it and leaves its activity alone", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, page } = await groupWithPage(adminCookie);
  const folder = await (await request(
    "POST",
    `/api/groups/${group.id}/folders`,
    adminCookie,
    { title: "Weltenbau" },
  )).json();

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/pages/${page.id}/folder`,
    adminCookie,
    { folderId: folder.id },
  );

  assert.equal(response.status, STATUS_CODE.OK);
  const moved = await response.json();
  assert.equal(moved.folderId, folder.id);
  // Moving is not writing: the page keeps its place in the order, and an editor that loaded it
  // before the move can still save against the time it holds.
  assert.equal(moved.lastActivityAt, page.lastActivityAt);
});

test("PUT /pages/{pageId}/folder refuses a folder from another group", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, page } = await groupWithPage(adminCookie);
  const elsewhere = await createGroup(adminCookie, "Andere Gruppe");
  const theirs = await (await request(
    "POST",
    `/api/groups/${elsewhere.id}/folders`,
    adminCookie,
    { title: "Fremd" },
  )).json();

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/pages/${page.id}/folder`,
    adminCookie,
    { folderId: theirs.id },
  );

  assert.equal(response.status, STATUS_CODE.NotFound);
});

test("PUT /pages/{pageId}/folder lets any writer move it, but not a reader", async () => {
  const adminCookie = await registerUser(administrator);
  const { group, page } = await groupWithPage(adminCookie);
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const byWriter = await request(
    "PUT",
    `/api/groups/${group.id}/pages/${page.id}/folder`,
    writerCookie,
    { folderId: null },
  );
  assert.equal(byWriter.status, STATUS_CODE.OK);

  const byReader = await request(
    "PUT",
    `/api/groups/${group.id}/pages/${page.id}/folder`,
    readerCookie,
    { folderId: null },
  );
  assert.equal(byReader.status, STATUS_CODE.Forbidden);
});
