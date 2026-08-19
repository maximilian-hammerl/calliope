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

const administrator = "delete-membership-admin";
const member = "delete-membership-member";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, member]));

Deno.test("DELETE /api/groups/{groupId}/memberships/{userId} removes a member", async () => {
  const adminCookie = await registerUser(administrator);
  await registerUser(member);
  const group = await createGroup(adminCookie, "Entfernen");
  const memberId = await getUserId(member);
  await request("POST", `/api/groups/${group.id}/memberships`, adminCookie, {
    userId: memberId,
  });

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/memberships/${memberId}`,
    adminCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  // The administrator is still there, so the group survives.
  assertEquals(await response.json(), { ok: true });
});

Deno.test("DELETE /api/groups/{groupId}/memberships/{userId} refuses a non-administrator", async () => {
  const adminCookie = await registerUser(administrator);
  const memberCookie = await registerUser(member);
  const group = await createGroup(adminCookie, "Entfernen", "public");
  const memberId = await getUserId(member);
  await request("POST", `/api/groups/${group.id}/memberships`, adminCookie, {
    userId: memberId,
  });
  await request(
    "POST",
    `/api/groups/${group.id}/memberships/me/accept`,
    memberCookie,
  );

  // A joined member is still not an administrator.
  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/memberships/${await getUserId(administrator)}`,
    memberCookie,
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
});
