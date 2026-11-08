import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";

const owner = "get-group-owner";
const outsider = "get-group-outsider";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([owner, outsider]));

test("GET /api/groups/{groupId} returns a public group to a non-member", async () => {
  const ownerCookie = await registerUser(owner);
  const created = await (await request("POST", "/api/groups", ownerCookie, {
    title: "Öffentlich",
    synopsis: "d",
    visibility: "public",
  })).json();

  const outsiderCookie = await registerUser(outsider);
  const response = await request(
    "GET",
    `/api/groups/${created.id}`,
    outsiderCookie,
  );

  assert.equal(response.status, STATUS_CODE.OK);
  assert.equal((await response.json()).id, created.id);
});

test("GET /api/groups/{groupId} reports a private group as missing to a non-member", async () => {
  const ownerCookie = await registerUser(owner);
  const created = await (await request("POST", "/api/groups", ownerCookie, {
    title: "Privat",
    synopsis: "d",
  })).json();

  const outsiderCookie = await registerUser(outsider);
  const response = await request(
    "GET",
    `/api/groups/${created.id}`,
    outsiderCookie,
  );

  // 404 rather than 403, so that the group's existence does not leak.
  assert.equal(response.status, STATUS_CODE.NotFound);
  assert.deepEqual(await response.json(), { error: "Group not found" });
});
