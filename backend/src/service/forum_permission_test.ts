import { test } from "node:test";
import assert from "node:assert/strict";
import type { User } from "#/src/service/user_service.ts";
import {
  effectiveMemberPermission,
  FORUM_ROOT_PERMISSION,
  mayReadForumContent,
  mostRestrictive,
} from "#/src/service/forum_permission.ts";

const member: User = {
  id: "11111111-1111-7111-8111-111111111111",
  username: "member",
  emailAddress: "member@example.com",
  emailAddressVerifiedAt: "2026-09-03T00:00:00Z",
  platformRole: null,
  bannedAt: null,
};

const operator: User = { ...member, platformRole: "moderator" };

test("the most restrictive setting wins, whichever side it is on", () => {
  assert.equal(mostRestrictive("write", "read"), "read");
  assert.equal(mostRestrictive("read", "write"), "read");
  assert.equal(mostRestrictive("read", "hidden"), "hidden");
  assert.equal(mostRestrictive("hidden", "write"), "hidden");
  assert.equal(mostRestrictive("write", "write"), "write");
});

test("a thread at the root is readable, not writable", () => {
  // `write` on a leaf means "I add no restriction of my own", so at the root, with nothing above
  // to answer, the forum's constant is what does.
  assert.equal(effectiveMemberPermission("write", null), "read");
  assert.equal(FORUM_ROOT_PERMISSION, "read");
});

test("a leaf takes the folder's answer, and cannot widen it", () => {
  assert.equal(effectiveMemberPermission("write", "write"), "write");
  assert.equal(effectiveMemberPermission("write", "read"), "read");
  assert.equal(effectiveMemberPermission("read", "write"), "read");
});

test("a leaf's own `hidden` hides it inside a folder anyone may write", () => {
  assert.equal(effectiveMemberPermission("hidden", "write"), "hidden");
  assert.equal(mayReadForumContent(member, "hidden", "write"), false);
});

test("an operator reads everything, and is told what members get", () => {
  assert.equal(mayReadForumContent(operator, "hidden", "hidden"), true);
  assert.equal(
    mayReadForumContent({ ...member, platformRole: "administrator" }, "hidden", null),
    true,
  );

  // The value itself is the members', whoever asked: it is what tells an operator that a folder
  // is hidden from everyone else, which is the whole reason it says nothing about the reader.
  assert.equal(effectiveMemberPermission("hidden", "hidden"), "hidden");
  assert.equal(effectiveMemberPermission("write", "read"), "read");
});

test("administering a writing group is not being an operator", () => {
  // `platform_role` is the site's; `user_in_writing_group_role` is one group's and reaches
  // nothing here.
  assert.equal(mayReadForumContent(member, "hidden", null), false);
});

test("reading is refused only by `hidden`", () => {
  assert.equal(mayReadForumContent(member, "read", null), true);
  assert.equal(mayReadForumContent(member, "write", "read"), true);
  assert.equal(mayReadForumContent(member, "read", "hidden"), false);
});
