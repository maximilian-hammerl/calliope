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

/**
 * Demoting a member to reader is the one move an ordinary group can make against an account it
 * believes is compromised, without waiting for an operator. It is only worth anything if it
 * freezes what that account already wrote — otherwise it stops the account writing and leaves it
 * free to delete the story.
 *
 * Through the routes rather than only over `mayAct`, because a route that forgot the helper
 * would pass the unit test and fail here.
 */
const administrator = "demotion-test-admin";
const member = "demotion-test-member";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, member]));

/** A member who wrote a thread, a post and a step, then lost the ability to write. */
async function demotedAfterWriting() {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Übernommenes Konto");
  const theirCookie = await addMember(adminCookie, group.id, member, "writer");

  const thread = await (await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    theirCookie,
    { title: "Ihr Thread" },
  )).json();
  const post = await (await request(
    "POST",
    `/api/groups/${group.id}/threads/${thread.id}/posts`,
    theirCookie,
    postBody("Ihr Beitrag."),
  )).json();
  const step = await (await request(
    "POST",
    `/api/groups/${group.id}/steps`,
    theirCookie,
    { text: "Ihr Schritt" },
  )).json();

  const memberships = await (await request(
    "GET",
    `/api/groups/${group.id}/memberships`,
    adminCookie,
  )).json();
  const theirs = memberships.results.find(
    (row: { username: string }) => row.username === member,
  );

  const demoted = await request(
    "PATCH",
    `/api/groups/${group.id}/memberships/${theirs.userId}`,
    adminCookie,
    { role: "reader" },
  );
  assertEquals(demoted.status, STATUS_CODE.OK);

  return { group, thread, post, step, theirCookie, adminCookie };
}

Deno.test("a demoted member cannot delete the post they wrote", async () => {
  const { group, thread, post, theirCookie } = await demotedAfterWriting();

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/threads/${thread.id}/posts/${post.id}`,
    theirCookie,
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
});

Deno.test("a demoted member cannot edit the post they wrote", async () => {
  const { group, thread, post, theirCookie } = await demotedAfterWriting();

  const response = await request(
    "PATCH",
    `/api/groups/${group.id}/threads/${thread.id}/posts/${post.id}`,
    theirCookie,
    postBody("Umgeschrieben."),
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
});

Deno.test("a demoted member cannot rename or delete the thread they started", async () => {
  const { group, thread, theirCookie } = await demotedAfterWriting();

  const renamed = await request(
    "PATCH",
    `/api/groups/${group.id}/threads/${thread.id}`,
    theirCookie,
    { title: "Umbenannt" },
  );
  assertEquals(renamed.status, STATUS_CODE.Forbidden);

  const deleted = await request(
    "DELETE",
    `/api/groups/${group.id}/threads/${thread.id}`,
    theirCookie,
  );
  assertEquals(deleted.status, STATUS_CODE.Forbidden);
});

Deno.test("a demoted member cannot delete the step they wrote", async () => {
  const { group, step, theirCookie } = await demotedAfterWriting();

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/steps/${step.id}`,
    theirCookie,
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
});

Deno.test("what they wrote is still there, and an administrator can still act on it", async () => {
  const { group, thread, post, adminCookie } = await demotedAfterWriting();

  // The point of freezing rather than deleting: the writing stays with the group.
  const read = await request(
    "GET",
    `/api/groups/${group.id}/threads/${thread.id}`,
    adminCookie,
  );
  assertEquals(read.status, STATUS_CODE.OK);

  const removed = await request(
    "DELETE",
    `/api/groups/${group.id}/threads/${thread.id}/posts/${post.id}`,
    adminCookie,
  );
  assertEquals(removed.status, STATUS_CODE.OK);
});
