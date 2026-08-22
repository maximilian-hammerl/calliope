import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { db } from "@/src/database/client.ts";
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
const outsider = "delete-membership-outsider";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, member, outsider]));

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

// The four below were `DELETE …/memberships/me/leave` until the two endpoints became one:
// "an administrator, or whoever it belongs to" is the rule `mayModify` already gives content.

Deno.test("DELETE /api/groups/{groupId}/memberships/{userId} lets a member leave", async () => {
  const adminCookie = await registerUser(administrator);
  const memberCookie = await registerUser(member);
  const group = await createGroup(adminCookie, "Verlassen", "public");
  const memberId = await getUserId(member);
  await request("POST", `/api/groups/${group.id}/memberships`, adminCookie, {
    userId: memberId,
  });
  await request(
    "POST",
    `/api/groups/${group.id}/memberships/me/accept`,
    memberCookie,
  );

  // A writer, not an administrator: allowed only because the row is their own.
  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/memberships/${memberId}`,
    memberCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  const remaining = await db
    .selectFrom("userInWritingGroup")
    .select("userId")
    .where("writingGroupId", "=", group.id)
    .execute();
  assertEquals(remaining.length, 1);
});

Deno.test("DELETE /api/groups/{groupId}/memberships/{userId} declines an invitation", async () => {
  const adminCookie = await registerUser(administrator);
  const memberCookie = await registerUser(member);
  const group = await createGroup(adminCookie, "Ablehnen", "public");
  const memberId = await getUserId(member);
  await request("POST", `/api/groups/${group.id}/memberships`, adminCookie, {
    userId: memberId,
  });

  // Never accepted, so this is a decline — the same act on the same row.
  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/memberships/${memberId}`,
    memberCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
});

Deno.test("DELETE /api/groups/{groupId}/memberships/{userId} takes the group with the last member", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Letztes Mitglied");

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/memberships/${await getUserId(administrator)}`,
    adminCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  // Asserted against the table rather than the API: a private group answers 404 to a
  // non-member whether or not it still exists. The trigger removes it, not this endpoint.
  const groups = await db
    .selectFrom("writingGroup")
    .select("id")
    .where("id", "=", group.id)
    .execute();
  assertEquals(groups.length, 0);
});

Deno.test("DELETE /api/groups/{groupId}/memberships/{userId} needs a membership to leave", async () => {
  const adminCookie = await registerUser(administrator);
  const outsiderCookie = await registerUser(outsider);
  const group = await createGroup(adminCookie, "Verlassen", "public");

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/memberships/${await getUserId(outsider)}`,
    outsiderCookie,
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});
