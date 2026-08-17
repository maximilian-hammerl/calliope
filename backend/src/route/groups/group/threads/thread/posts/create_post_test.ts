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

const administrator = "create-post-admin";
const reader = "create-post-reader";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, reader]));

async function thread() {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Beiträge");
  const created =
    await (await request("POST", `/groups/${group.id}/threads`, adminCookie, {
      title: "Kapitel 1",
    })).json();

  return { adminCookie, group, thread: created };
}

Deno.test("POST /groups/{groupId}/threads/{threadId}/posts writes a published post", async () => {
  const { adminCookie, group, thread: created } = await thread();

  const response = await request(
    "POST",
    `/groups/${group.id}/threads/${created.id}/posts`,
    adminCookie,
    { text: "Es war einmal" },
  );

  assertEquals(response.status, STATUS_CODE.Created);
  const post = await response.json();
  assertEquals(post.text, "Es war einmal");
  // Published unless the author asks for a draft.
  assertEquals(post.isDraft, false);
});

Deno.test("POST /groups/{groupId}/threads/{threadId}/posts refuses a reader", async () => {
  const { adminCookie, group, thread: created } = await thread();
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request(
    "POST",
    `/groups/${group.id}/threads/${created.id}/posts`,
    readerCookie,
    { text: "Nein" },
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
});
