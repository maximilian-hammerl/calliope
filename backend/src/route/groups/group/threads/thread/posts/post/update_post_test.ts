import { assert, assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  documentOf,
  registerUser,
  request,
} from "@/src/test_support.ts";

const administrator = "update-post-admin";
const writer = "update-post-writer";
const other = "update-post-other";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, writer, other]));

async function draftByWriter() {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Beitrag");
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");
  const thread = await (await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    adminCookie,
    {
      title: "Kapitel 1",
    },
  )).json();
  const posts = `/api/groups/${group.id}/threads/${thread.id}/posts`;
  const draft = await (await request("POST", posts, writerCookie, {
    document: documentOf("Entwurf"),
    isDraft: true,
  })).json();

  return { adminCookie, writerCookie, group, posts, draft };
}

Deno.test("PATCH …/posts/{postId} publishes the author's own draft", async () => {
  const { writerCookie, posts, draft } = await draftByWriter();

  const response = await request(
    "PATCH",
    `${posts}/${draft.id}`,
    writerCookie,
    {
      isDraft: false,
    },
  );

  assertEquals(response.status, STATUS_CODE.OK);
  const published = await response.json();
  assertEquals(published.isDraft, false);
  // The text was left alone.
  assertEquals(published.text, "Entwurf");
});

Deno.test("PATCH …/posts/{postId} dates a published post from its publication", async () => {
  const { writerCookie, posts, draft } = await draftByWriter();

  const published = await (await request(
    "PATCH",
    `${posts}/${draft.id}`,
    writerCookie,
    { isDraft: false },
  )).json();

  // The draft may have been sitting for days while it was written. Its post is new, so it
  // sorts to the end of the thread rather than into the middle of it...
  assert(published.createdAt > draft.createdAt);
  // ...and it does not announce itself as edited the moment it appears.
  assertEquals(published.editedAt, null);
});

Deno.test("PATCH …/posts/{postId} does not mark an autosaved draft as edited", async () => {
  const { writerCookie, posts, draft } = await draftByWriter();

  // Every keystroke in the composer is one of these. None of them is an edit.
  const saved =
    await (await request("PATCH", `${posts}/${draft.id}`, writerCookie, {
      document: documentOf("Weiter geschrieben."),
    })).json();

  assertEquals(saved.editedAt, null);
});

Deno.test("PATCH …/posts/{postId} marks a real edit as edited", async () => {
  const { writerCookie, posts, draft } = await draftByWriter();

  const published = await (await request(
    "PATCH",
    `${posts}/${draft.id}`,
    writerCookie,
    { isDraft: false },
  )).json();

  const edited = await (await request(
    "PATCH",
    `${posts}/${draft.id}`,
    writerCookie,
    { document: documentOf("Doch anders.") },
  )).json();

  // Publication must not have blunted the signal that actually means "edited".
  assertEquals(edited.createdAt, published.createdAt);
  assert(edited.editedAt !== null);
});

Deno.test("PATCH …/posts/{postId} refuses another writer", async () => {
  const { adminCookie, writerCookie, group, posts } = await draftByWriter();
  const otherCookie = await addMember(adminCookie, group.id, other, "writer");
  const published = await (await request("POST", posts, writerCookie, {
    document: documentOf("Veröffentlicht"),
  })).json();

  const response = await request(
    "PATCH",
    `${posts}/${published.id}`,
    otherCookie,
    {
      document: documentOf("Übernommen"),
    },
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
});
