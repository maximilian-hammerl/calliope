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

const administrator = "update-membership-admin";
const member = "update-membership-member";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([administrator, member]));

async function groupWithInvitee() {
  const adminCookie = await registerUser(administrator);
  const memberCookie = await registerUser(member);
  const group = await createGroup(adminCookie, "Rollen");
  const memberId = await getUserId(member);

  await request("POST", `/api/groups/${group.id}/memberships`, adminCookie, {
    userId: memberId,
  });

  return { adminCookie, memberCookie, group, memberId };
}

test("PATCH /api/groups/{groupId}/memberships/{userId} changes the role", async () => {
  const { adminCookie, group, memberId } = await groupWithInvitee();

  const response = await request(
    "PATCH",
    `/api/groups/${group.id}/memberships/${memberId}`,
    adminCookie,
    { role: "reader" },
  );

  assert.equal(response.status, STATUS_CODE.OK);
  const membership = await response.json();
  assert.equal(membership.role, "reader");
  // Changing a role must not quietly accept the invitation on the user's behalf.
  assert.equal(membership.status, "invited");
});

test("PATCH /api/groups/{groupId}/memberships/{userId} cannot set the status", async () => {
  const { adminCookie, group, memberId } = await groupWithInvitee();

  const response = await request(
    "PATCH",
    `/api/groups/${group.id}/memberships/${memberId}`,
    adminCookie,
    { status: "joined" },
  );

  // `status` is not part of the body schema, so `role` is simply missing.
  assert.equal(response.status, STATUS_CODE.BadRequest);
  assert.deepEqual(
    (await response.json()).issues.map((issue: { path: string }) => issue.path),
    ["role"],
  );
});
