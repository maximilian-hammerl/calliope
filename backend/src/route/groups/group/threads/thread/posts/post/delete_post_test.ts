import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "#/src/http/status.ts";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  postBody,
  registerUser,
  request,
} from "#/src/test/support.ts";

const administrator = "delete-post-admin";
const writer = "delete-post-writer";
const other = "delete-post-other";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([administrator, writer, other]));

async function postByWriter() {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Beitrag");
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");
  const thread = await (
    await request("POST", `/api/groups/${group.id}/threads`, adminCookie, {
      title: "Kapitel 1",
    })
  ).json();
  const posts = `/api/groups/${group.id}/threads/${thread.id}/posts`;
  const post = await (await request("POST", posts, writerCookie, postBody("Es war einmal"))).json();

  return { adminCookie, writerCookie, group, posts, post };
}

test("DELETE …/posts/{postId} lets an administrator delete another's post", async () => {
  const { adminCookie, posts, post } = await postByWriter();

  const response = await request("DELETE", `${posts}/${post.id}`, adminCookie);

  assert.equal(response.status, STATUS_CODE.OK);
  assert.deepEqual(await response.json(), { ok: true });

  const gone = await request("GET", `${posts}/${post.id}`, adminCookie);
  assert.equal(gone.status, STATUS_CODE.NotFound);
});

test("DELETE …/posts/{postId} refuses another writer", async () => {
  const { adminCookie, group, posts, post } = await postByWriter();
  const otherCookie = await addMember(adminCookie, group.id, other, "writer");

  const response = await request("DELETE", `${posts}/${post.id}`, otherCookie);

  assert.equal(response.status, STATUS_CODE.Forbidden);
});
