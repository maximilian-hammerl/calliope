import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "#/src/http/status.ts";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  registerUser,
  request,
} from "#/src/test/support.ts";

const administrator = "update-thread-admin";
const writer = "update-thread-writer";
const other = "update-thread-other";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([administrator, writer, other]));

async function threadByWriter() {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Faden");
  const writerCookie = await addMember(adminCookie, group.id, writer, "writer");
  const thread = await (
    await request("POST", `/api/groups/${group.id}/threads`, writerCookie, { title: "Vorher" })
  ).json();

  return { adminCookie, writerCookie, group, thread };
}

test("PATCH /api/groups/{groupId}/threads/{threadId} lets an administrator rename another's thread", async () => {
  const { adminCookie, group, thread } = await threadByWriter();

  const response = await request(
    "PATCH",
    `/api/groups/${group.id}/threads/${thread.id}`,
    adminCookie,
    { title: "Nachher" },
  );

  assert.equal(response.status, STATUS_CODE.OK);
  assert.equal((await response.json()).title, "Nachher");
});

test("PATCH /api/groups/{groupId}/threads/{threadId} refuses another writer", async () => {
  const { adminCookie, group, thread } = await threadByWriter();
  const otherCookie = await addMember(adminCookie, group.id, other, "writer");

  // A writer may start threads, but not edit somebody else's.
  const response = await request(
    "PATCH",
    `/api/groups/${group.id}/threads/${thread.id}`,
    otherCookie,
    { title: "Übernommen" },
  );

  assert.equal(response.status, STATUS_CODE.Forbidden);
});
