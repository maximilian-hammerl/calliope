import { assertEquals } from "@std/assert";
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

const administrator = "create-post-admin";
const reader = "create-post-reader";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, reader]));

async function thread() {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Beiträge");
  const created = await (await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    adminCookie,
    {
      title: "Kapitel 1",
    },
  )).json();

  return { adminCookie, group, thread: created };
}

Deno.test("POST /api/groups/{groupId}/threads/{threadId}/posts names the author", async () => {
  const { adminCookie, group, thread: created } = await thread();

  const response = await request(
    "POST",
    `/api/groups/${group.id}/threads/${created.id}/posts`,
    adminCookie,
    postBody("Es war einmal"),
  );

  const post = await response.json();
  // Joined rather than stored, so a client never has to resolve the id itself.
  assertEquals(post.createdByUsername, administrator);
  assertEquals(post.createdBy !== undefined, true);
});

Deno.test("POST /api/groups/{groupId}/threads/{threadId}/posts writes a published post", async () => {
  const { adminCookie, group, thread: created } = await thread();

  const response = await request(
    "POST",
    `/api/groups/${group.id}/threads/${created.id}/posts`,
    adminCookie,
    postBody("Es war einmal"),
  );

  assertEquals(response.status, STATUS_CODE.Created);
  const post = await response.json();
  assertEquals(post.text, "Es war einmal");
  // Published unless the author asks for a draft.
  assertEquals(post.isDraft, false);
});

Deno.test("POST /api/groups/{groupId}/threads/{threadId}/posts refuses a reader", async () => {
  const { adminCookie, group, thread: created } = await thread();
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request(
    "POST",
    `/api/groups/${group.id}/threads/${created.id}/posts`,
    readerCookie,
    postBody("Nein"),
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
});
