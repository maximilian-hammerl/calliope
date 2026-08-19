import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";

const administrator = "create-thread-admin";
const reader = "create-thread-reader";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([administrator, reader]));

Deno.test("POST /api/groups/{groupId}/threads starts a thread", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Fäden");

  const response = await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    adminCookie,
    { title: "Kapitel 1" },
  );

  assertEquals(response.status, STATUS_CODE.Created);
  const thread = await response.json();
  assertEquals(thread.title, "Kapitel 1");
  assertEquals(thread.writingGroupId, group.id);
});

Deno.test("POST /api/groups/{groupId}/threads refuses a reader", async () => {
  const adminCookie = await registerUser(administrator);
  const group = await createGroup(adminCookie, "Fäden");
  const readerCookie = await addMember(adminCookie, group.id, reader, "reader");

  const response = await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    readerCookie,
    { title: "Kapitel 1" },
  );

  assertEquals(response.status, STATUS_CODE.Forbidden);
});
