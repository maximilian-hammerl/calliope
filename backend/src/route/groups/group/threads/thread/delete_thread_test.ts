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

const administrator = "delete-thread-admin";
const writer = "delete-thread-writer";
const other = "delete-thread-other";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, writer, other]));

Deno.test("DELETE /groups/{groupId}/threads/{threadId} deletes the thread and its posts", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Faden");
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");
  const thread =
    await (await request("POST", `/groups/${group.id}/threads`, writerCookie, {
      title: "Kapitel 1",
    })).json();
  const post = await (await request(
    "POST",
    `/groups/${group.id}/threads/${thread.id}/posts`,
    writerCookie,
    { text: "Es war einmal" },
  )).json();

  // The author may delete their own thread.
  const response = await request(
    "DELETE",
    `/groups/${group.id}/threads/${thread.id}`,
    writerCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { ok: true });

  // The post went with it through the foreign key's cascade.
  const gone = await request(
    "GET",
    `/groups/${group.id}/threads/${thread.id}/posts/${post.id}`,
    adminCookie,
  );
  assertEquals(gone.status, STATUS_CODE.NotFound);
});

Deno.test("DELETE /groups/{groupId}/threads/{threadId} refuses another writer", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Faden");
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");
  const otherCookie = await addMember(adminCookie, group.id, other, "writer");
  const thread =
    await (await request("POST", `/groups/${group.id}/threads`, writerCookie, {
      title: "Kapitel 1",
    })).json();

  const response = await request(
    "DELETE",
    `/groups/${group.id}/threads/${thread.id}`,
    otherCookie,
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
});
