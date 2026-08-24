import { assertEquals, assertFalse } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  postBody,
  registerUser,
  request,
} from "@/src/test/support.ts";

const administrator = "list-posts-admin";
const writer = "list-posts-writer";
const outsider = "list-posts-outsider";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, writer, outsider]));

async function threadWithDraft() {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Beiträge");
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

  await request("POST", posts, writerCookie, postBody("Veröffentlicht"));
  await request(
    "POST",
    posts,
    writerCookie,
    postBody("Entwurf", { isDraft: true }),
  );

  return { adminCookie, writerCookie, posts };
}

Deno.test("QUERY …/posts lets a non-member read a public group's posts, but no drafts", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Offen zu lesen", "public");
  const thread = await (await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    adminCookie,
    { title: "Kapitel 1" },
  )).json();
  const posts = `/api/groups/${group.id}/threads/${thread.id}/posts`;
  await request("POST", posts, adminCookie, postBody("Veröffentlicht"));
  await request(
    "POST",
    posts,
    adminCookie,
    postBody("Entwurf", { isDraft: true }),
  );

  const outsiderCookie = await registerUser(outsider);
  const response = await request("QUERY", posts, outsiderCookie, {
    limit: 100,
  });

  // Reading a public group is the point of it being public; the draft is still its author's
  // alone, which `readableBy` enforces regardless of who is asking.
  assertEquals(response.status, STATUS_CODE.OK);
  const page = await response.json();
  assertEquals(page.results.map((one: { text: string }) => one.text), [
    "Veröffentlicht",
  ]);

  const asked = await (await request("QUERY", posts, outsiderCookie, {
    limit: 100,
    isDraft: true,
  })).json();
  assertEquals(asked.results.length, 0);
});

Deno.test("QUERY …/posts leaves the author's own draft out of the thread", async () => {
  const { writerCookie, posts } = await threadWithDraft();

  // The composer holds the draft, so it must not also appear among the posts — and it must
  // not be counted, or an empty thread would report a post nobody can read.
  const response = await request("QUERY", posts, writerCookie, { limit: 10 });

  assertEquals(response.status, STATUS_CODE.OK);
  const page = await response.json();
  assertEquals(page.totalResults, 1);
  assertEquals(
    page.results.map((post: { text: string }) => post.text),
    ["Veröffentlicht"],
  );
});

Deno.test("QUERY …/posts returns the author's own draft when asked for", async () => {
  const { writerCookie, posts } = await threadWithDraft();

  const response = await request("QUERY", posts, writerCookie, {
    limit: 10,
    isDraft: true,
  });

  assertEquals(response.status, STATUS_CODE.OK);
  const page = await response.json();
  assertEquals(page.totalResults, 1);
  assertEquals(
    page.results.map((post: { text: string }) => post.text),
    ["Entwurf"],
  );
});

Deno.test("QUERY …/posts never returns another member's draft, even when asked for", async () => {
  const { adminCookie, posts } = await threadWithDraft();

  // The filter selects which of the readable posts are wanted; it cannot widen what is
  // readable. Asking for drafts as somebody else returns one's own, which here is none.
  const response = await request("QUERY", posts, adminCookie, {
    limit: 10,
    isDraft: true,
  });

  assertEquals(response.status, STATUS_CODE.OK);
  const page = await response.json();
  assertEquals(page.totalResults, 0);
});

Deno.test("QUERY …/posts hides another member's draft, even from an administrator", async () => {
  const { adminCookie, posts } = await threadWithDraft();

  const response = await request("QUERY", posts, adminCookie, { limit: 10 });

  const page = await response.json();
  // A draft is written before publishing, so nobody else sees it yet.
  assertEquals(page.totalResults, 1);
  assertFalse(
    page.results.some((post: { text: string }) => post.text === "Entwurf"),
  );
});
