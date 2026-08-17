import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test_support.ts";

const owner = "update-group-owner";
const outsider = "update-group-outsider";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([owner, outsider]));

function createGroup(cookie: string, visibility: "public" | "private") {
  return request("POST", "/api/groups", cookie, {
    title: "Vorher",
    description: "d",
    visibility,
  }).then((response) => response.json());
}

Deno.test("PATCH /api/groups/{groupId} updates a group the user administers", async () => {
  const cookie = await registerUser(owner);
  const created = await createGroup(cookie, "private");

  const response = await request("PATCH", `/api/groups/${created.id}`, cookie, {
    title: "Nachher",
    visibility: "public",
  });

  assertEquals(response.status, STATUS_CODE.OK);
  const updated = await response.json();
  assertEquals(updated.title, "Nachher");
  assertEquals(updated.visibility, "public");
  // Untouched fields keep their values.
  assertEquals(updated.description, created.description);
});

Deno.test("PATCH /api/groups/{groupId} refuses a non-administrator of a public group", async () => {
  const ownerCookie = await registerUser(owner);
  const created = await createGroup(ownerCookie, "public");

  const outsiderCookie = await registerUser(outsider);
  const response = await request(
    "PATCH",
    `/api/groups/${created.id}`,
    outsiderCookie,
    { title: "Übernommen" },
  );

  // 403 rather than 404: the group is public, so its existence is not a secret.
  assertEquals(response.status, STATUS_CODE.Forbidden);
  assertEquals(await response.json(), {
    error: "Only administrators can update a group",
  });
});
