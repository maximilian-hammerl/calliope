import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";

const owner = "get-group-owner";
const outsider = "get-group-outsider";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([owner, outsider]));

Deno.test("GET /api/groups/{groupId} returns a public group to a non-member", async () => {
  const ownerCookie = await registerUser(owner);
  const created = await (await request("POST", "/api/groups", ownerCookie, {
    title: "Öffentlich",
    synopsis: "d",
    visibility: "public",
  })).json();

  const outsiderCookie = await registerUser(outsider);
  const response = await request(
    "GET",
    `/api/groups/${created.id}`,
    outsiderCookie,
  );

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals((await response.json()).id, created.id);
});

Deno.test("GET /api/groups/{groupId} reports a private group as missing to a non-member", async () => {
  const ownerCookie = await registerUser(owner);
  const created = await (await request("POST", "/api/groups", ownerCookie, {
    title: "Privat",
    synopsis: "d",
  })).json();

  const outsiderCookie = await registerUser(outsider);
  const response = await request(
    "GET",
    `/api/groups/${created.id}`,
    outsiderCookie,
  );

  // 404 rather than 403, so that the group's existence does not leak.
  assertEquals(response.status, STATUS_CODE.NotFound);
  assertEquals(await response.json(), { error: "Group not found" });
});
