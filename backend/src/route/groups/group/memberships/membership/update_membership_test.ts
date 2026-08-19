import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";

const administrator = "update-membership-admin";
const member = "update-membership-member";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, member]));

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

Deno.test("PATCH /api/groups/{groupId}/memberships/{userId} changes the role", async () => {
  const { adminCookie, group, memberId } = await groupWithInvitee();

  const response = await request(
    "PATCH",
    `/api/groups/${group.id}/memberships/${memberId}`,
    adminCookie,
    { role: "reader" },
  );

  assertEquals(response.status, STATUS_CODE.OK);
  const membership = await response.json();
  assertEquals(membership.role, "reader");
  // Changing a role must not quietly accept the invitation on the user's behalf.
  assertEquals(membership.status, "invited");
});

Deno.test("PATCH /api/groups/{groupId}/memberships/{userId} cannot set the status", async () => {
  const { adminCookie, group, memberId } = await groupWithInvitee();

  const response = await request(
    "PATCH",
    `/api/groups/${group.id}/memberships/${memberId}`,
    adminCookie,
    { status: "joined" },
  );

  // `status` is not part of the body schema, so `role` is simply missing.
  assertEquals(response.status, STATUS_CODE.BadRequest);
  assertEquals(
    (await response.json()).issues.map((issue: { path: string }) => issue.path),
    ["role"],
  );
});
