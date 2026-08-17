import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
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
    text: "Entwurf",
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

Deno.test("PATCH …/posts/{postId} refuses another writer", async () => {
  const { adminCookie, writerCookie, group, posts } = await draftByWriter();
  const otherCookie = await addMember(adminCookie, group.id, other, "writer");
  const published = await (await request("POST", posts, writerCookie, {
    text: "Veröffentlicht",
  })).json();

  const response = await request(
    "PATCH",
    `${posts}/${published.id}`,
    otherCookie,
    {
      text: "Übernommen",
    },
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
});
