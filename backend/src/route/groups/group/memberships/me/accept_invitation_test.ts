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

const administrator = "accept-invitation-admin";
const invitee = "accept-invitation-invitee";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, invitee]));

Deno.test("POST /api/groups/{groupId}/memberships/me/accept joins the group", async () => {
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

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals((await response.json()).status, "joined");
});

Deno.test("POST /api/groups/{groupId}/memberships/me/accept needs an invitation", async () => {
  const adminCookie = await registerUser(administrator);
  const inviteeCookie = await registerUser(invitee);
  const group = await createGroup(adminCookie, "Annahme", "public");

  // Seeing a public group is not the same as being invited to it.
  const response = await request(
    "POST",
    `/api/groups/${group.id}/memberships/me/accept`,
    inviteeCookie,
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
  assertEquals(await response.json(), { error: "Invitation not found" });
});
