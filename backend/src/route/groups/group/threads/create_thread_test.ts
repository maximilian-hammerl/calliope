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

const administrator = "create-thread-admin";
const reader = "create-thread-reader";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([administrator, reader]));

test("POST /api/groups/{groupId}/threads starts a thread", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Fäden");

  const response = await request("POST", `/api/groups/${group.id}/threads`, adminCookie, {
    title: "Kapitel 1",
  });

  assert.equal(response.status, STATUS_CODE.Created);
  const thread = await response.json();
  assert.equal(thread.title, "Kapitel 1");
  assert.equal(thread.writingGroupId, group.id);
});

test("POST /api/groups/{groupId}/threads refuses a reader", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Fäden");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request("POST", `/api/groups/${group.id}/threads`, readerCookie, {
    title: "Kapitel 1",
  });

  assert.equal(response.status, STATUS_CODE.Forbidden);
});
