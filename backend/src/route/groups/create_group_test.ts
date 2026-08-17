import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { db } from "@/src/database/client.ts";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test_support.ts";

const username = "create-group-test-user";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([username]));

Deno.test("POST /api/groups creates a group and makes the creator its administrator", async () => {
  const cookie = await registerUser(username);

  const response = await request("POST", "/api/groups", cookie, {
    title: "Fantasy-Projekt",
    description: "Ein gemeinsames Projekt",
  });

  assertEquals(response.status, STATUS_CODE.Created);
  const group = await response.json();
  assertEquals(group.title, "Fantasy-Projekt");
  // Private unless the request asks otherwise.
  assertEquals(group.visibility, "private");

  const membership = await db
    .selectFrom("userInWritingGroup")
    .innerJoin("user", "user.id", "userInWritingGroup.userId")
    .select(["userInWritingGroup.role", "user.username"])
    .where("userInWritingGroup.writingGroupId", "=", group.id)
    .execute();

  assertEquals(membership, [{ role: "administrator", username }]);
  assertEquals(
    group.createdBy,
    (await db
      .selectFrom("user")
      .select("id")
      .where("username", "=", username)
      .executeTakeFirstOrThrow()).id,
  );
});

Deno.test("POST /api/groups rejects a body without a title", async () => {
  const cookie = await registerUser(username);

  const response = await request("POST", "/api/groups", cookie, {
    description: "Kein Titel",
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assertEquals(body.error, "Invalid request");
  assertEquals(body.issues.map((issue: { path: string }) => issue.path), [
    "title",
  ]);
});
