import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import {
  FOLDER_CYCLE,
  FOLDER_NOT_EMPTY,
  FOLDER_TOO_DEEP,
} from "@/src/http/response.ts";
import { MAX_FOLDER_DEPTH } from "@/src/service/writing_folder_service.ts";

const administrator = "folders-test-admin";
const writer = "folders-test-writer";
const reader = "folders-test-reader";
const stranger = "folders-test-stranger";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() =>
  deleteUsers([administrator, writer, reader, stranger])
);

async function makeFolder(
  cookie: string,
  groupId: string,
  title: string,
  parentFolderId?: string,
) {
  const response = await request(
    "POST",
    `/api/groups/${groupId}/folders`,
    cookie,
    { title, ...(parentFolderId === undefined ? {} : { parentFolderId }) },
  );
  assertEquals(response.status, STATUS_CODE.Created);
  return await response.json();
}

Deno.test("POST /api/groups/{groupId}/folders adds a root folder", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");

  const folder = await makeFolder(adminCookie, group.id, "Weltenbau");

  assertEquals(folder.title, "Weltenbau");
  assertEquals(folder.parentFolderId, null);
  assertEquals(folder.depth, 1);
  assertEquals(folder.createdByUsername, administrator);
});

Deno.test("POST /api/groups/{groupId}/folders nests under a parent", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const root = await makeFolder(adminCookie, group.id, "Weltenbau");

  const child = await makeFolder(adminCookie, group.id, "Stadt A", root.id);

  assertEquals(child.depth, 2);
  assertEquals(child.parentFolderId, root.id);
});

Deno.test("POST /api/groups/{groupId}/folders refuses a sixth level with 422", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");

  let deepest = await makeFolder(adminCookie, group.id, "Ebene 1");
  for (let level = 2; level <= MAX_FOLDER_DEPTH; level++) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose: each level needs the one above
    deepest = await makeFolder(
      adminCookie,
      group.id,
      `Ebene ${level}`,
      deepest.id,
    );
  }

  const response = await request(
    "POST",
    `/api/groups/${group.id}/folders`,
    adminCookie,
    { title: "Zu tief", parentFolderId: deepest.id },
  );

  assertEquals(response.status, STATUS_CODE.UnprocessableEntity);
  assertEquals((await response.json()).code, FOLDER_TOO_DEEP);
});

Deno.test("POST /api/groups/{groupId}/folders refuses a reader with 403", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request(
    "POST",
    `/api/groups/${group.id}/folders`,
    readerCookie,
    { title: "Sollte nicht gehen" },
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
});

Deno.test("POST /api/groups/{groupId}/folders refuses a parent from another group", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const elsewhere = await createGroup(adminCookie, "Andere Gruppe");
  const theirs = await makeFolder(adminCookie, elsewhere.id, "Fremd");

  const response = await request(
    "POST",
    `/api/groups/${group.id}/folders`,
    adminCookie,
    { title: "Kind", parentFolderId: theirs.id },
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});

Deno.test("GET /api/groups/{groupId}/folders lets a reader read, and hides a private group", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  await makeFolder(adminCookie, group.id, "Weltenbau");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");
  const strangerCookie = await registerUser(stranger);

  const theirs = await request(
    "GET",
    `/api/groups/${group.id}/folders`,
    readerCookie,
  );
  assertEquals(theirs.status, STATUS_CODE.OK);
  assertEquals((await theirs.json()).results.length, 1);

  const outside = await request(
    "GET",
    `/api/groups/${group.id}/folders`,
    strangerCookie,
  );
  assertEquals(outside.status, STATUS_CODE.NotFound);
});

Deno.test("PUT /api/groups/{groupId}/folders/{folderId} renames and clears the description", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const folder = await makeFolder(adminCookie, group.id, "Weltenbau");

  const named = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${folder.id}`,
    adminCookie,
    { title: "Welt", description: "Was in der Welt gilt." },
  );
  assertEquals(named.status, STATUS_CODE.OK);
  assertEquals((await named.json()).description, "Was in der Welt gilt.");

  const cleared = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${folder.id}`,
    adminCookie,
    { title: "Welt", description: null },
  );
  assertEquals((await cleared.json()).description, null);
});

Deno.test("PUT /api/groups/{groupId}/folders/{folderId} lets any writer rename it, but not a reader", async () => {
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
  assertEquals(byWriter.status, STATUS_CODE.OK);
  assertEquals((await byWriter.json()).title, "Welt");

  const byReader = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${folder.id}`,
    readerCookie,
    { title: "Sollte nicht gehen", description: null },
  );
  assertEquals(byReader.status, STATUS_CODE.Forbidden);
});

Deno.test("DELETE /api/groups/{groupId}/folders/{folderId} lets any writer delete an empty one", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const folder = await makeFolder(adminCookie, group.id, "Leer");
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/folders/${folder.id}`,
    writerCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
});

Deno.test("DELETE /api/groups/{groupId}/folders/{folderId} removes an empty folder", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const folder = await makeFolder(adminCookie, group.id, "Leer");

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/folders/${folder.id}`,
    adminCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  const { results } = await (await request(
    "GET",
    `/api/groups/${group.id}/folders`,
    adminCookie,
  )).json();
  assertEquals(results.length, 0);
});

Deno.test("DELETE /api/groups/{groupId}/folders/{folderId} refuses one holding a page with 409", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const folder = await makeFolder(adminCookie, group.id, "Weltenbau");

  const page = await request(
    "POST",
    `/api/groups/${group.id}/pages`,
    adminCookie,
    {
      title: "Die Bergstadt",
      document: plainTextToDocument("Ein Hafen im Norden."),
      folderId: folder.id,
    },
  );
  assertEquals(page.status, STATUS_CODE.Created);
  assertEquals((await page.json()).folderId, folder.id);

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/folders/${folder.id}`,
    adminCookie,
  );

  assertEquals(response.status, STATUS_CODE.Conflict);
  assertEquals((await response.json()).code, FOLDER_NOT_EMPTY);
});

Deno.test("DELETE /api/groups/{groupId}/folders/{folderId} refuses one holding a thread with 409", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const folder = await makeFolder(adminCookie, group.id, "Weltenbau");

  const thread = await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    adminCookie,
    { title: "Der lange Aufstieg", folderId: folder.id },
  );
  assertEquals(thread.status, STATUS_CODE.Created);
  assertEquals((await thread.json()).folderId, folder.id);

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/folders/${folder.id}`,
    adminCookie,
  );

  assertEquals(response.status, STATUS_CODE.Conflict);
});

Deno.test("a thread or page in another group's folder is refused", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const elsewhere = await createGroup(adminCookie, "Andere Gruppe");
  const theirs = await makeFolder(adminCookie, elsewhere.id, "Fremd");

  const thread = await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    adminCookie,
    { title: "Fremd einsortiert", folderId: theirs.id },
  );
  assertEquals(thread.status, STATUS_CODE.NotFound);

  const page = await request(
    "POST",
    `/api/groups/${group.id}/pages`,
    adminCookie,
    {
      title: "Fremd einsortiert",
      document: plainTextToDocument("Text."),
      folderId: theirs.id,
    },
  );
  assertEquals(page.status, STATUS_CODE.NotFound);
});

Deno.test("PUT /folders/{folderId}/parent moves it under another folder", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const weltenbau = await makeFolder(adminCookie, group.id, "Weltenbau");
  const stadt = await makeFolder(
    adminCookie,
    group.id,
    "Stadt A",
    weltenbau.id,
  );
  const figuren = await makeFolder(adminCookie, group.id, "Figuren");

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${stadt.id}/parent`,
    adminCookie,
    { parentFolderId: figuren.id },
  );

  assertEquals(response.status, STATUS_CODE.OK);
  const moved = await response.json();
  assertEquals(moved.parentFolderId, figuren.id);
  assertEquals(moved.depth, 2);
});

Deno.test("PUT /folders/{folderId}/parent moves it to the root", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const weltenbau = await makeFolder(adminCookie, group.id, "Weltenbau");
  const stadt = await makeFolder(
    adminCookie,
    group.id,
    "Stadt A",
    weltenbau.id,
  );

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${stadt.id}/parent`,
    adminCookie,
    { parentFolderId: null },
  );

  assertEquals(response.status, STATUS_CODE.OK);
  const moved = await response.json();
  assertEquals(moved.parentFolderId, null);
  assertEquals(moved.depth, 1);
});

Deno.test("PUT /folders/{folderId}/parent refuses a move into its own subtree", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const weltenbau = await makeFolder(adminCookie, group.id, "Weltenbau");
  const stadt = await makeFolder(
    adminCookie,
    group.id,
    "Stadt A",
    weltenbau.id,
  );

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${weltenbau.id}/parent`,
    adminCookie,
    { parentFolderId: stadt.id },
  );

  assertEquals(response.status, STATUS_CODE.UnprocessableEntity);
  assertEquals((await response.json()).code, FOLDER_CYCLE);
});

Deno.test("PUT /folders/{folderId}/parent refuses a subtree that would be too deep", async () => {
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

  assertEquals(response.status, STATUS_CODE.UnprocessableEntity);
  assertEquals((await response.json()).code, FOLDER_TOO_DEEP);
});

Deno.test("PUT /folders/{folderId}/parent lets any writer move it, but not a reader", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Weltenbau");
  const weltenbau = await makeFolder(adminCookie, group.id, "Weltenbau");
  const stadt = await makeFolder(
    adminCookie,
    group.id,
    "Stadt A",
    weltenbau.id,
  );
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const byWriter = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${stadt.id}/parent`,
    writerCookie,
    { parentFolderId: null },
  );
  assertEquals(byWriter.status, STATUS_CODE.OK);
  assertEquals((await byWriter.json()).depth, 1);

  const byReader = await request(
    "PUT",
    `/api/groups/${group.id}/folders/${stadt.id}/parent`,
    readerCookie,
    { parentFolderId: weltenbau.id },
  );
  assertEquals(byReader.status, STATUS_CODE.Forbidden);
});
