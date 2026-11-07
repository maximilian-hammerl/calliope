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

const administrator = "get-thread-admin";
const reader = "get-thread-reader";
const outsider = "get-thread-outsider";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([administrator, reader, outsider]));

async function groupWithThread() {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Faden");
  const thread = await (await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    adminCookie,
    { title: "Kapitel 1" },
  )).json();

  return { adminCookie, group, thread };
}

test("GET /api/groups/{groupId}/threads/{threadId} returns the thread to a reader", async () => {
  const { adminCookie, group, thread } = await groupWithThread();
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request(
    "GET",
    `/api/groups/${group.id}/threads/${thread.id}`,
    readerCookie,
  );

  assert.equal(response.status, STATUS_CODE.OK);
  assert.equal((await response.json()).id, thread.id);
});

test("GET /api/groups/{groupId}/threads/{threadId} hides the thread from a non-member", async () => {
  const { group, thread } = await groupWithThread();
  const outsiderCookie = await registerUser(outsider);

  const response = await request(
    "GET",
    `/api/groups/${group.id}/threads/${thread.id}`,
    outsiderCookie,
  );

  assert.equal(response.status, STATUS_CODE.NotFound);
});
