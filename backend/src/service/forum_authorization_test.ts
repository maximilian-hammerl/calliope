import { assertEquals, assertThrows } from "@std/assert";
import type { User } from "@/src/service/user_service.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";

const member: User = {
  id: "11111111-1111-7111-8111-111111111111",
  username: "member",
  emailAddress: "member@example.com",
  emailAddressVerifiedAt: "2026-09-03T00:00:00Z",
  platformRole: null,
  bannedAt: null,
};

const other = "22222222-2222-7222-8222-222222222222";
const operator: User = { ...member, platformRole: "moderator" };

const theirs = { createdBy: member.id, userId: member.id };
const somebodyElses = { createdBy: other, userId: member.id };

Deno.test("making something needs the row to grant `write`", () => {
  assertEquals(mayActInForum(member, "write", "thread:create"), true);
  assertEquals(mayActInForum(member, "read", "thread:create"), false);
  assertEquals(mayActInForum(member, "hidden", "thread:create"), false);

  assertEquals(mayActInForum(member, "write", "post:create"), true);
  assertEquals(mayActInForum(member, "read", "post:create"), false);

  assertEquals(mayActInForum(member, "write", "page:create"), true);
  assertEquals(mayActInForum(member, "read", "page:create"), false);
});

Deno.test("a page is changed by whoever may write there, not by whoever wrote it", () => {
  // The forum's counterpart of the group's `writer` rule for pages: material a community keeps
  // cannot be held to the first person who typed it.
  assertEquals(mayActInForum(member, "write", "page:change"), true);
  assertEquals(mayActInForum(member, "read", "page:change"), false);
});

Deno.test("a post belongs to whoever wrote it", () => {
  assertEquals(mayActInForum(member, "write", "post:change", theirs), true);
  assertEquals(
    mayActInForum(member, "write", "post:change", somebodyElses),
    false,
  );
  assertEquals(mayActInForum(member, "write", "post:delete", theirs), true);
  assertEquals(
    mayActInForum(member, "write", "post:delete", somebodyElses),
    false,
  );
});

Deno.test("closing a folder freezes what was written in it", () => {
  // The containment the group's table has for demotion: losing write here stops somebody
  // changing and deleting their own posts as well as writing new ones.
  assertEquals(mayActInForum(member, "read", "post:change", theirs), false);
  assertEquals(mayActInForum(member, "read", "post:delete", theirs), false);
  assertEquals(mayActInForum(member, "hidden", "post:change", theirs), false);
});

Deno.test("a post whose author is gone is left to the operators", () => {
  // `createdBy` is null once that account is deleted, and null never equals a user id.
  assertEquals(
    mayActInForum(member, "write", "post:change", {
      createdBy: null,
      userId: member.id,
    }),
    false,
  );
  assertEquals(
    mayActInForum(operator, "write", "post:change", {
      createdBy: null,
      userId: operator.id,
    }),
    true,
  );
});

Deno.test("an operator passes either rule, whatever the row grants", () => {
  assertEquals(mayActInForum(operator, "hidden", "thread:create"), true);
  assertEquals(mayActInForum(operator, "read", "page:change"), true);
  assertEquals(
    mayActInForum(operator, "hidden", "post:delete", somebodyElses),
    true,
  );
  assertEquals(
    mayActInForum(
      { ...member, platformRole: "administrator" },
      "read",
      "page:create",
    ),
    true,
  );
});

Deno.test("an author act asked without its content is a bug, not a case", () => {
  assertThrows(
    // deno-lint-ignore no-explicit-any -- the overloads refuse this, which is the point
    () => (mayActInForum as any)(member, "write", "post:change"),
    Error,
    "decided by its author",
  );
});

Deno.test("the forum's own shape is nobody's but an operator's", () => {
  assertEquals(mayActInForum(member, "folder:create"), false);
  assertEquals(mayActInForum(member, "folder:move"), false);
  assertEquals(mayActInForum(member, "folder:delete"), false);
  assertEquals(mayActInForum(member, "permission:change"), false);

  assertEquals(mayActInForum(operator, "folder:create"), true);
  assertEquals(mayActInForum(operator, "permission:change"), true);
});

/**
 * The forum has no administrators, so the operator is the group administrator's counterpart: the
 * `author` rule already answers for both, which is why renaming needed no rule of its own.
 */
Deno.test("a thread is renamed by its author, or by an operator", () => {
  const somebodyElses = { createdBy: "someone-else", userId: member.id };

  assertEquals(
    mayActInForum(member, "write", "thread:change", {
      createdBy: member.id,
      userId: member.id,
    }),
    true,
  );
  assertEquals(
    mayActInForum(member, "write", "thread:change", somebodyElses),
    false,
  );
  assertEquals(
    mayActInForum(operator, "write", "thread:change", somebodyElses),
    true,
  );
});
