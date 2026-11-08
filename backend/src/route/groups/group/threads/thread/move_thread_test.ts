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

const administrator = "move-thread-admin";
const writer = "move-thread-writer";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([administrator, writer]));

async function aGroupWithThreadAndFolder(cookie: string) {
  const group = await createGroup(cookie, "Weltenbau");
  const thread = await (
    await request("POST", `/api/groups/${group.id}/threads`, cookie, { title: "Ankunft" })
  ).json();
  const folder = await (
    await request("POST", `/api/groups/${group.id}/folders`, cookie, { title: "Weltenbau" })
  ).json();
  // Read after the setup: creating the thread legitimately bumped the group, and the baseline
  // has to be what the group looked like immediately before the move.
  const before = await (await request("GET", `/api/groups/${group.id}`, cookie)).json();
  return {
    group,
    thread,
    folder,
    groupActivityBefore: before.lastActivityAt as string,
  };
}

test("PUT /threads/{threadId}/folder moves it and leaves its activity alone", async () => {
  const cookie = await registerUser(administrator);
  const { group, thread, folder, groupActivityBefore } = await aGroupWithThreadAndFolder(cookie);

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/threads/${thread.id}/folder`,
    cookie,
    { folderId: folder.id },
  );

  assert.equal(response.status, STATUS_CODE.OK);
  const moved = await response.json();
  assert.equal(moved.folderId, folder.id);
  // Moving is not writing: the thread keeps its place in the order, and its group does too.
  assert.equal(moved.lastActivityAt, thread.lastActivityAt);

  const groupAfter = await (await request("GET", `/api/groups/${group.id}`, cookie)).json();
  assert.equal(groupAfter.lastActivityAt, groupActivityBefore);
});

test("PUT /threads/{threadId}/folder moves it back to the root", async () => {
  const cookie = await registerUser(administrator);
  const { group, thread, folder } = await aGroupWithThreadAndFolder(cookie);

  await request("PUT", `/api/groups/${group.id}/threads/${thread.id}/folder`, cookie, {
    folderId: folder.id,
  });
  const response = await request(
    "PUT",
    `/api/groups/${group.id}/threads/${thread.id}/folder`,
    cookie,
    { folderId: null },
  );

  assert.equal(response.status, STATUS_CODE.OK);
  assert.equal((await response.json()).folderId, null);
});

test("PUT /threads/{threadId}/folder refuses a folder from another group", async () => {
  const cookie = await registerUser(administrator);
  const { group, thread } = await aGroupWithThreadAndFolder(cookie);
  const elsewhere = await createGroup(cookie, "Andere Gruppe");
  const theirs = await (
    await request("POST", `/api/groups/${elsewhere.id}/folders`, cookie, { title: "Fremd" })
  ).json();

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/threads/${thread.id}/folder`,
    cookie,
    { folderId: theirs.id },
  );

  assert.equal(response.status, STATUS_CODE.NotFound);
});

test("PUT /threads/{threadId}/folder refuses a writer who did not start it", async () => {
  const cookie = await registerUser(administrator);
  const { group, thread, folder } = await aGroupWithThreadAndFolder(cookie);
  const writerCookie = await addMember(cookie, group.id, writer, "writer");

  const response = await request(
    "PUT",
    `/api/groups/${group.id}/threads/${thread.id}/folder`,
    writerCookie,
    { folderId: folder.id },
  );

  assert.equal(response.status, STATUS_CODE.Forbidden);
});
