import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "#/src/http/status.ts";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
  request,
} from "#/src/test/support.ts";

const administrator = "accept-invitation-admin";
const invitee = "accept-invitation-invitee";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([administrator, invitee]));

test("POST /api/groups/{groupId}/memberships/me/accept joins the group", async () => {
  const adminCookie = await registerUser(administrator);
  const inviteeCookie = await registerUser(invitee);
  const group = await createGroup(adminCookie, "Annahme");
  await request("POST", `/api/groups/${group.id}/memberships`, adminCookie, {
    userId: await getUserId(invitee),
  });

  const response = await request(
    "POST",
    `/api/groups/${group.id}/memberships/me/accept`,
    inviteeCookie,
  );

  assert.equal(response.status, STATUS_CODE.OK);
  assert.equal((await response.json()).status, "joined");
});

test("POST /api/groups/{groupId}/memberships/me/accept needs an invitation", async () => {
  const adminCookie = await registerUser(administrator);
  const inviteeCookie = await registerUser(invitee);
  const group = await createGroup(adminCookie, "Annahme", "public");

  // Seeing a public group is not the same as being invited to it.
  const response = await request(
    "POST",
    `/api/groups/${group.id}/memberships/me/accept`,
    inviteeCookie,
  );

  assert.equal(response.status, STATUS_CODE.NotFound);
  assert.deepEqual(await response.json(), { error: "Invitation not found" });
});
