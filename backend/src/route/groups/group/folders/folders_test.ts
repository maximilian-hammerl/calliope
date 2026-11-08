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
import { FOLDER_CYCLE, FOLDER_NOT_EMPTY, FOLDER_TOO_DEEP } from "@/src/http/response.ts";
import { MAX_FOLDER_DEPTH } from "@/src/service/writing_folder_service.ts";

const administrator = "folders-test-admin";
const writer = "folders-test-writer";
const reader = "folders-test-reader";
const stranger = "folders-test-stranger";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([administrator, writer, reader, stranger]));

async function makeFolder(cookie: string, groupId: string, title: string, parentFolderId?: string) {
  const response = await request("POST", `/api/groups/${groupId}/folders`, cookie, {
    title,
    ...(parentFolderId === undefined ? {} : { parentFolderId }),
  });
  assert.equal(response.status, STATUS_CODE.Created);
  return await response.json();
}

test("POST /api/groups/{groupId}/folders adds a root folder", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");

  const folder = await makeFolder(adminCookie, group.id, "Weltenbau");

  assert.equal(folder.title, "Weltenbau");
  assert.equal(folder.parentFolderId, null);
  assert.equal(folder.depth, 1);
  assert.equal(folder.createdByUsername, administrator);
});

test("POST /api/groups/{groupId}/folders nests under a parent", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const root = await makeFolder(adminCookie, group.id, "Weltenbau");

  const child = await makeFolder(adminCookie, group.id, "Stadt A", root.id);

  assert.equal(child.depth, 2);
  assert.equal(child.parentFolderId, root.id);
});

test("POST /api/groups/{groupId}/folders refuses a sixth level with 422", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");

  let deepest = await makeFolder(adminCookie, group.id, "Ebene 1");
  for (let level = 2; level <= MAX_FOLDER_DEPTH; level++) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose: each level needs the one above
    deepest = await makeFolder(adminCookie, group.id, `Ebene ${level}`, deepest.id);
  }

  const response = await request("POST", `/api/groups/${group.id}/folders`, adminCookie, {
    title: "Zu tief",
    parentFolderId: deepest.id,
  });

  assert.equal(response.status, STATUS_CODE.UnprocessableEntity);
  assert.equal((await response.json()).code, FOLDER_TOO_DEEP);
});

test("POST /api/groups/{groupId}/folders refuses a reader with 403", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request("POST", `/api/groups/${group.id}/folders`, readerCookie, {
    title: "Sollte nicht gehen",
  });

  assert.equal(response.status, STATUS_CODE.Forbidden);
});

test("POST /api/groups/{groupId}/folders refuses a parent from another group", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const elsewhere = await createGroup(adminCookie, "Andere Gruppe");
  const theirs = await makeFolder(adminCookie, elsewhere.id, "Fremd");

  const response = await request("POST", `/api/groups/${group.id}/folders`, adminCookie, {
    title: "Kind",
    parentFolderId: theirs.id,
  });

  assert.equal(response.status, STATUS_CODE.NotFound);
});

test("GET /api/groups/{groupId}/folders lets a reader read, and hides a private group", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  await makeFolder(adminCookie, group.id, "Weltenbau");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");
  const strangerCookie = await registerUser(stranger);

  const theirs = await request("GET", `/api/groups/${group.id}/folders`, readerCookie);
  assert.equal(theirs.status, STATUS_CODE.OK);
  assert.equal((await theirs.json()).results.length, 1);

  const outside = await request("GET", `/api/groups/${group.id}/folders`, strangerCookie);
  assert.equal(outside.status, STATUS_CODE.NotFound);
});

test("PUT /api/groups/{groupId}/folders/{folderId} renames and clears the description", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const folder = await makeFolder(adminCookie, group.id, "Weltenbau");

  const named = await request("PUT", `/api/groups/${group.id}/folders/${folder.id}`, adminCookie, {
    title: "Welt",
    description: "Was in der Welt gilt.",
  });
  assert.equal(named.status, STATUS_CODE.OK);
  assert.equal((await named.json()).description, "Was in der Welt gilt.");

  const cleared = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${folder.id}`,
    adminCookie,
    { title: "Welt", description: null },
  );
  assert.equal((await cleared.json()).description, null);
});

test("PUT /api/groups/{groupId}/folders/{folderId} lets any writer rename it, but not a reader", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const folder = await makeFolder(adminCookie, group.id, "Weltenbau");
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  // The group's own structure, so any writer may change it — the same permission as making one.
  const byWriter = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${folder.id}`,
    writerCookie,
    { title: "Welt", description: null },
  );
  assert.equal(byWriter.status, STATUS_CODE.OK);
  assert.equal((await byWriter.json()).title, "Welt");

  const byReader = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${folder.id}`,
    readerCookie,
    { title: "Sollte nicht gehen", description: null },
  );
  assert.equal(byReader.status, STATUS_CODE.Forbidden);
});

test("DELETE /api/groups/{groupId}/folders/{folderId} lets any writer delete an empty one", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const folder = await makeFolder(adminCookie, group.id, "Leer");
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/folders/${folder.id}`,
    writerCookie,
  );

  assert.equal(response.status, STATUS_CODE.OK);
});

test("DELETE /api/groups/{groupId}/folders/{folderId} removes an empty folder", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const folder = await makeFolder(adminCookie, group.id, "Leer");

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/folders/${folder.id}`,
    adminCookie,
  );

  assert.equal(response.status, STATUS_CODE.OK);
  const { results } = await (
    await request("GET", `/api/groups/${group.id}/folders`, adminCookie)
  ).json();
  assert.equal(results.length, 0);
});

test("DELETE /api/groups/{groupId}/folders/{folderId} refuses one holding a page with 409", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const folder = await makeFolder(adminCookie, group.id, "Weltenbau");

  const page = await request("POST", `/api/groups/${group.id}/pages`, adminCookie, {
    title: "Die Bergstadt",
    document: plainTextToDocument("Ein Hafen im Norden."),
    folderId: folder.id,
  });
  assert.equal(page.status, STATUS_CODE.Created);
  assert.equal((await page.json()).folderId, folder.id);

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/folders/${folder.id}`,
    adminCookie,
  );

  assert.equal(response.status, STATUS_CODE.Conflict);
  assert.equal((await response.json()).code, FOLDER_NOT_EMPTY);
});

test("DELETE /api/groups/{groupId}/folders/{folderId} refuses one holding a thread with 409", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const folder = await makeFolder(adminCookie, group.id, "Weltenbau");

  const thread = await request("POST", `/api/groups/${group.id}/threads`, adminCookie, {
    title: "Der lange Aufstieg",
    folderId: folder.id,
  });
  assert.equal(thread.status, STATUS_CODE.Created);
  assert.equal((await thread.json()).folderId, folder.id);

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/folders/${folder.id}`,
    adminCookie,
  );

  assert.equal(response.status, STATUS_CODE.Conflict);
});

test("a thread or page in another group's folder is refused", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const elsewhere = await createGroup(adminCookie, "Andere Gruppe");
  const theirs = await makeFolder(adminCookie, elsewhere.id, "Fremd");

  const thread = await request("POST", `/api/groups/${group.id}/threads`, adminCookie, {
    title: "Fremd einsortiert",
    folderId: theirs.id,
  });
  assert.equal(thread.status, STATUS_CODE.NotFound);

  const page = await request("POST", `/api/groups/${group.id}/pages`, adminCookie, {
    title: "Fremd einsortiert",
    document: plainTextToDocument("Text."),
    folderId: theirs.id,
  });
  assert.equal(page.status, STATUS_CODE.NotFound);
});

test("PUT /folders/{folderId}/parent moves it under another folder", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const weltenbau = await makeFolder(adminCookie, group.id, "Weltenbau");
  const stadt = await makeFolder(adminCookie, group.id, "Stadt A", weltenbau.id);
  const figuren = await makeFolder(adminCookie, group.id, "Figuren");

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${stadt.id}/parent`,
    adminCookie,
    { parentFolderId: figuren.id },
  );

  assert.equal(response.status, STATUS_CODE.OK);
  const moved = await response.json();
  assert.equal(moved.parentFolderId, figuren.id);
  assert.equal(moved.depth, 2);
});

test("PUT /folders/{folderId}/parent moves it to the root", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const weltenbau = await makeFolder(adminCookie, group.id, "Weltenbau");
  const stadt = await makeFolder(adminCookie, group.id, "Stadt A", weltenbau.id);

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${stadt.id}/parent`,
    adminCookie,
    { parentFolderId: null },
  );

  assert.equal(response.status, STATUS_CODE.OK);
  const moved = await response.json();
  assert.equal(moved.parentFolderId, null);
  assert.equal(moved.depth, 1);
});

test("PUT /folders/{folderId}/parent refuses a move into its own subtree", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const weltenbau = await makeFolder(adminCookie, group.id, "Weltenbau");
  const stadt = await makeFolder(adminCookie, group.id, "Stadt A", weltenbau.id);

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${weltenbau.id}/parent`,
    adminCookie,
    { parentFolderId: stadt.id },
  );

  assert.equal(response.status, STATUS_CODE.UnprocessableEntity);
  assert.equal((await response.json()).code, FOLDER_CYCLE);
});

test("PUT /folders/{folderId}/parent refuses a subtree that would be too deep", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");

  // Two levels tall, and a chain deep enough that it no longer fits.
  const top = await makeFolder(adminCookie, group.id, "Oben");
  await makeFolder(adminCookie, group.id, "Unten", top.id);

  let deepest = await makeFolder(adminCookie, group.id, "E1");
  for (const title of ["E2", "E3", "E4"]) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose: each level needs the one above
    deepest = await makeFolder(adminCookie, group.id, title, deepest.id);
  }

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${top.id}/parent`,
    adminCookie,
    { parentFolderId: deepest.id },
  );

  assert.equal(response.status, STATUS_CODE.UnprocessableEntity);
  assert.equal((await response.json()).code, FOLDER_TOO_DEEP);
});

test("PUT /folders/{folderId}/parent lets any writer move it, but not a reader", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const weltenbau = await makeFolder(adminCookie, group.id, "Weltenbau");
  const stadt = await makeFolder(adminCookie, group.id, "Stadt A", weltenbau.id);
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const byWriter = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${stadt.id}/parent`,
    writerCookie,
    { parentFolderId: null },
  );
  assert.equal(byWriter.status, STATUS_CODE.OK);
  assert.equal((await byWriter.json()).depth, 1);

  const byReader = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${stadt.id}/parent`,
    readerCookie,
    { parentFolderId: weltenbau.id },
  );
  assert.equal(byReader.status, STATUS_CODE.Forbidden);
});
