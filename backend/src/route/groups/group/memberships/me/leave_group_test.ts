import { assertEquals } from "@std/assert";
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

Deno.test("DELETE /groups/{groupId}/memberships/me/leave deletes the group with its last member", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Verlassen");

  const response = await request(
    "DELETE",
    `/groups/${group.id}/memberships/me/leave`,
    adminCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  // Groups exist only for their members, so the last one out takes the group along.
  assertEquals(await response.json(), { ok: true, writingGroupDeleted: true });

  const gone = await request("GET", `/groups/${group.id}`, adminCookie);
  assertEquals(gone.status, STATUS_CODE.NotFound);
});

Deno.test("DELETE /groups/{groupId}/memberships/me/leave needs a membership", async () => {
  const adminCookie = await registerUser(administrator);
  const outsiderCookie = await registerUser(outsider);
  const group = await createGroup(adminCookie, "Verlassen", "public");

  const response = await request(
    "DELETE",
    `/groups/${group.id}/memberships/me/leave`,
    outsiderCookie,
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});
