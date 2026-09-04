import { assertEquals } from "@std/assert";
import type { User } from "@/src/service/user_service.ts";
import {
  effectiveMemberPermission,
  FORUM_ROOT_PERMISSION,
  mayReadForumContent,
  mostRestrictive,
} from "@/src/service/forum_permission.ts";

const member: User = {
  id: "11111111-1111-7111-8111-111111111111",
  username: "member",
  emailAddress: "member@example.com",
  emailAddressVerifiedAt: "2026-09-03T00:00:00Z",
  platformRole: null,
  bannedAt: null,
};

const operator: User = { ...member, platformRole: "moderator" };

Deno.test("the most restrictive setting wins, whichever side it is on", () => {
  assertEquals(mostRestrictive("write", "read"), "read");
  assertEquals(mostRestrictive("read", "write"), "read");
  assertEquals(mostRestrictive("read", "hidden"), "hidden");
  assertEquals(mostRestrictive("hidden", "write"), "hidden");
  assertEquals(mostRestrictive("write", "write"), "write");
});

Deno.test("a thread at the root is readable, not writable", () => {
  // `write` on a leaf means "I add no restriction of my own", so at the root, with nothing above
  // to answer, the forum's constant is what does.
  assertEquals(effectiveMemberPermission("write", null), "read");
  assertEquals(FORUM_ROOT_PERMISSION, "read");
});

Deno.test("a leaf takes the folder's answer, and cannot widen it", () => {
  assertEquals(effectiveMemberPermission("write", "write"), "write");
  assertEquals(effectiveMemberPermission("write", "read"), "read");
  assertEquals(effectiveMemberPermission("read", "write"), "read");
});

Deno.test("a leaf's own `hidden` hides it inside a folder anyone may write", () => {
  assertEquals(effectiveMemberPermission("hidden", "write"), "hidden");
  assertEquals(mayReadForumContent(member, "hidden", "write"), false);
});

Deno.test("an operator reads everything, and is told what members get", () => {
  assertEquals(mayReadForumContent(operator, "hidden", "hidden"), true);
  assertEquals(
    mayReadForumContent(
      { ...member, platformRole: "administrator" },
      "hidden",
      null,
    ),
    true,
  );

  // The value itself is the members', whoever asked: it is what tells an operator that a folder
  // is hidden from everyone else, which is the whole reason it says nothing about the reader.
  assertEquals(effectiveMemberPermission("hidden", "hidden"), "hidden");
  assertEquals(effectiveMemberPermission("write", "read"), "read");
});

Deno.test("administering a writing group is not being an operator", () => {
  // `platform_role` is the site's; `user_in_writing_group_role` is one group's and reaches
  // nothing here.
  assertEquals(mayReadForumContent(member, "hidden", null), false);
});

Deno.test("reading is refused only by `hidden`", () => {
  assertEquals(mayReadForumContent(member, "read", null), true);
  assertEquals(mayReadForumContent(member, "write", "read"), true);
  assertEquals(mayReadForumContent(member, "read", "hidden"), false);
});
