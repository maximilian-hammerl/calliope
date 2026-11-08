import { test } from "node:test";
import assert from "node:assert/strict";
import type { User } from "#/src/service/user_service.ts";
import { mayActInForum } from "#/src/service/forum_authorization.ts";

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

test("making something needs the row to grant `write`", () => {
  assert.equal(mayActInForum(member, "write", "thread:create"), true);
  assert.equal(mayActInForum(member, "read", "thread:create"), false);
  assert.equal(mayActInForum(member, "hidden", "thread:create"), false);

  assert.equal(mayActInForum(member, "write", "post:create"), true);
  assert.equal(mayActInForum(member, "read", "post:create"), false);

  assert.equal(mayActInForum(member, "write", "page:create"), true);
  assert.equal(mayActInForum(member, "read", "page:create"), false);
});

test("a page is changed by whoever may write there, not by whoever wrote it", () => {
  // The forum's counterpart of the group's `writer` rule for pages: material a community keeps
  // cannot be held to the first person who typed it.
  assert.equal(mayActInForum(member, "write", "page:change"), true);
  assert.equal(mayActInForum(member, "read", "page:change"), false);
});

test("a post belongs to whoever wrote it", () => {
  assert.equal(mayActInForum(member, "write", "post:change", theirs), true);
  assert.equal(mayActInForum(member, "write", "post:change", somebodyElses), false);
  assert.equal(mayActInForum(member, "write", "post:delete", theirs), true);
  assert.equal(mayActInForum(member, "write", "post:delete", somebodyElses), false);
});

test("closing a folder freezes what was written in it", () => {
  // The containment the group's table has for demotion: losing write here stops somebody
  // changing and deleting their own posts as well as writing new ones.
  assert.equal(mayActInForum(member, "read", "post:change", theirs), false);
  assert.equal(mayActInForum(member, "read", "post:delete", theirs), false);
  assert.equal(mayActInForum(member, "hidden", "post:change", theirs), false);
});

test("a post whose author is gone is left to the operators", () => {
  // `createdBy` is null once that account is deleted, and null never equals a user id.
  assert.equal(
    mayActInForum(member, "write", "post:change", {
      createdBy: null,
      userId: member.id,
    }),
    false,
  );
  assert.equal(
    mayActInForum(operator, "write", "post:change", {
      createdBy: null,
      userId: operator.id,
    }),
    true,
  );
});

test("an operator passes either rule, whatever the row grants", () => {
  assert.equal(mayActInForum(operator, "hidden", "thread:create"), true);
  assert.equal(mayActInForum(operator, "read", "page:change"), true);
  assert.equal(mayActInForum(operator, "hidden", "post:delete", somebodyElses), true);
  assert.equal(
    mayActInForum({ ...member, platformRole: "administrator" }, "read", "page:create"),
    true,
  );
});

test("an author act asked without its content is a bug, not a case", () => {
  assert.throws(
    // oxlint-disable-next-line no-explicit-any -- the overloads refuse this, which is the point
    () => (mayActInForum as any)(member, "write", "post:change"),
    { message: /decided by its author/u },
  );
});

test("the forum's own shape is nobody's but an operator's", () => {
  assert.equal(mayActInForum(member, "folder:create"), false);
  assert.equal(mayActInForum(member, "folder:move"), false);
  assert.equal(mayActInForum(member, "folder:delete"), false);
  assert.equal(mayActInForum(member, "permission:change"), false);

  assert.equal(mayActInForum(operator, "folder:create"), true);
  assert.equal(mayActInForum(operator, "permission:change"), true);
});

/**
 * The forum has no administrators, so the operator is the group administrator's counterpart: the
 * `author` rule already answers for both, which is why renaming needed no rule of its own.
 */
test("a thread is renamed by its author, or by an operator", () => {
  const somebodyElses = { createdBy: "someone-else", userId: member.id };

  assert.equal(
    mayActInForum(member, "write", "thread:change", {
      createdBy: member.id,
      userId: member.id,
    }),
    true,
  );
  assert.equal(mayActInForum(member, "write", "thread:change", somebodyElses), false);
  assert.equal(mayActInForum(operator, "write", "thread:change", somebodyElses), true);
});
