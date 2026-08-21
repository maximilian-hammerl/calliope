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

const administrator = "list-memberships-admin";
const invitee = "list-memberships-invitee";
const outsider = "list-memberships-outsider";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, invitee, outsider]));

Deno.test("GET /api/groups/{groupId}/memberships lists members and invitations", async () => {
  const adminCookie = await registerUser(administrator);
  await registerUser(invitee);
  const group = await createGroup(adminCookie, "Mitglieder");
  await request("POST", `/api/groups/${group.id}/memberships`, adminCookie, {
    userId: await getUserId(invitee),
  });

  const response = await request(
    "GET",
    `/api/groups/${group.id}/memberships`,
    adminCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  const { results } = await response.json();
  // Everyone, in one answer and with no page to ask for: a member missing from the list of who
  // is in a group is worse than a long list.
  assertEquals(results.length, 2);
  // The name comes back with the membership, so the member list needs no second lookup, and it
  // is what the rows are ordered by.
  assertEquals(
    results.map((m: { username: string }) => m.username),
    [administrator, invitee].toSorted(),
  );
  assertEquals(
    results.map((m: { status: string }) => m.status).toSorted(),
    ["invited", "joined"],
  );
});

Deno.test("GET /api/groups/{groupId}/memberships hides a private group from an outsider", async () => {
  const adminCookie = await registerUser(administrator);
  const outsiderCookie = await registerUser(outsider);
  const group = await createGroup(adminCookie, "Mitglieder");

  const response = await request(
    "GET",
    `/api/groups/${group.id}/memberships`,
    outsiderCookie,
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});
