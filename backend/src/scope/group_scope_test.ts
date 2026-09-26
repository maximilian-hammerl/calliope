import { assert, assertEquals } from "@std/assert";
import { Hono } from "hono";
import {
  clearRateLimits,
  deleteUsers,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";
import { clearForum } from "@/src/test/forum.ts";
import {
  forumWithChildren,
  groupWithChildren,
} from "@/src/test/route_fixtures.ts";
import { type User, UserService } from "@/src/service/user_service.ts";
import { joinedGroup, visibleGroup } from "@/src/scope/group_scope.ts";

const OWNER = "group-scope-owner";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(async () => {
  await clearForum([OWNER]);
  await deleteUsers([OWNER]);
});

Deno.test("each resolver refuses a malformed id with the validators' 400", async () => {
  const cookie = await registerUser(OWNER);
  const group = await groupWithChildren(cookie, "Gruppe");
  const forum = await forumWithChildren(
    "Pfad",
    "write",
    await getUserId(OWNER),
  );
  const inGroup = `/api/groups/${group.groupId}`;

  // Every position a resolver reads, with the ids before it real.
  const cases: Array<[method: string, path: string, name: string]> = [
    ["GET", "/api/groups/x/threads", "groupId"],
    ["POST", "/api/groups/x/threads", "groupId"],
    ["GET", `${inGroup}/threads/x`, "threadId"],
    ["GET", `${inGroup}/threads/${group.threadId}/posts/x`, "postId"],
    ["GET", `${inGroup}/pages/x`, "pageId"],
    ["DELETE", `${inGroup}/folders/x`, "folderId"],
    ["DELETE", `${inGroup}/steps/x`, "stepId"],
    ["DELETE", `${inGroup}/memberships/x`, "userId"],
    ["GET", "/api/forum/threads/x", "threadId"],
    ["DELETE", `/api/forum/threads/${forum.threadId}/posts/x`, "postId"],
    ["GET", "/api/forum/pages/x", "pageId"],
    ["DELETE", "/api/forum/folders/x", "folderId"],
  ];

  const answered = async (method: string, path: string) => {
    // No body: the resolver refuses the id before a validator would read one.
    const response = await request(method, path, cookie);
    return { status: response.status, body: await response.json() };
  };
  for (const [method, path, name] of cases) {
    assertEquals(
      // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
      await answered(method, path),
      {
        status: 400,
        body: {
          error: "Invalid request",
          issues: [{ path: name, message: "Invalid UUID" }],
        },
      },
      `${method} ${path}`,
    );
  }
});

Deno.test("a group's id is handed on as the database writes it, whatever case the path used", async () => {
  const cookie = await registerUser(OWNER);
  const { groupId } = await groupWithChildren(cookie, "Gruppe");
  const user = await UserService.selectUser(OWNER, "a-complex-password");
  assert(user !== undefined);

  const withUser = () =>
    new Hono<{ Variables: { user: User } }>().use(async (c, next) => {
      c.set("user", user);
      await next();
    });
  const probes = [
    withUser().get(
      "/:groupId",
      visibleGroup,
      (c) => c.json({ id: c.get("group").id }),
    ),
    withUser().get(
      "/:groupId",
      joinedGroup,
      (c) => c.json({ id: c.get("group").id }),
    ),
  ];

  const handedOn = async (probe: (typeof probes)[number]) => {
    const response = await probe.request(`/${groupId?.toUpperCase()}`);
    return (await response.json()).id;
  };
  for (const probe of probes) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one resolver per iteration
    assertEquals(await handedOn(probe), groupId);
  }
});
