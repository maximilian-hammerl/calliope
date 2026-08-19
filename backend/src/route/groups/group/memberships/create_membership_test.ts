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

const administrator = "create-membership-admin";
const invitee = "create-membership-invitee";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, invitee]));

Deno.test("POST /api/groups/{groupId}/memberships invites a user", async () => {
  const adminCookie = await registerUser(administrator);
  await registerUser(invitee);
  const group = await createGroup(adminCookie, "Einladung");

  const response = await request(
    "POST",
    `/api/groups/${group.id}/memberships`,
    adminCookie,
    { userId: await getUserId(invitee) },
  );

  assertEquals(response.status, STATUS_CODE.Created);
  const membership = await response.json();
  // Always an invitation, never a membership, whatever the request asked for.
  assertEquals(membership.status, "invited");
  assertEquals(membership.role, "writer");
});

Deno.test("POST /api/groups/{groupId}/memberships refuses a non-administrator", async () => {
  const adminCookie = await registerUser(administrator);
  const inviteeCookie = await registerUser(invitee);
  const group = await createGroup(adminCookie, "Einladung", "public");

  // The invitee can see the public group, but cannot invite anyone to it.
  const response = await request(
    "POST",
    `/api/groups/${group.id}/memberships`,
    inviteeCookie,
    { userId: await getUserId(invitee) },
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
  assertEquals(await response.json(), {
    error: "Only administrators can invite users",
  });
});
