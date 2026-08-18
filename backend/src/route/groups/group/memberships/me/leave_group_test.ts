import { assertEquals } from "@std/assert";
import { db } from "@/src/database/client.ts";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test_support.ts";

const administrator = "leave-group-admin";
const outsider = "leave-group-outsider";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, outsider]));

Deno.test("DELETE /api/groups/{groupId}/memberships/me/leave removes the membership", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Verlassen");

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/memberships/me/leave`,
    adminCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { ok: true });

  const memberships = await db
    .selectFrom("userInWritingGroup")
    .select("userId")
    .where("writingGroupId", "=", group.id)
    .execute();
  assertEquals(memberships.length, 0);

  // Asserted against the table rather than through the API: the group is private, so a
  // non-member is answered 404 whether or not it still exists. Removing the last member is
  // meant to remove the group too, which is a database trigger and not this endpoint's job.
});

Deno.test("DELETE /api/groups/{groupId}/memberships/me/leave needs a membership", async () => {
  const adminCookie = await registerUser(administrator);
  const outsiderCookie = await registerUser(outsider);
  const group = await createGroup(adminCookie, "Verlassen", "public");

  const response = await request(
    "DELETE",
    `/api/groups/${group.id}/memberships/me/leave`,
    outsiderCookie,
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});
