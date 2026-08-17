import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test_support.ts";

const administrator = "list-threads-admin";
const reader = "list-threads-reader";
const outsider = "list-threads-outsider";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, reader, outsider]));

Deno.test("QUERY /groups/{groupId}/threads lists threads for any member", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Fäden");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");
  await request("POST", `/groups/${group.id}/threads`, adminCookie, {
    title: "Kapitel 1",
  });

  // A reader may not write, but may read.
  const response = await request(
    "QUERY",
    `/groups/${group.id}/threads`,
    readerCookie,
    { limit: 10 },
  );

  assertEquals(response.status, STATUS_CODE.OK);
  const page = await response.json();
  assertEquals(page.totalResults, 1);
  assertEquals(page.results[0].title, "Kapitel 1");
});

Deno.test("QUERY /groups/{groupId}/threads hides a public group's threads from a non-member", async () => {
  const adminCookie = await registerUser(administrator);
  const outsiderCookie = await registerUser(outsider);
  const group = await createGroup(adminCookie, "Fäden", "public");

  // The group itself is public, but its contents are for members only.
  assertEquals(
    (await request("GET", `/groups/${group.id}`, outsiderCookie)).status,
    STATUS_CODE.OK,
  );

  const response = await request(
    "QUERY",
    `/groups/${group.id}/threads`,
    outsiderCookie,
    {},
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});
