import { test } from "node:test";
import assert from "node:assert/strict";
import { PLATFORM_ROLES } from "@/src/database/schema.ts";
import { mayAdministerPlatform, mayModeratePlatform } from "./platform_authorization.ts";

test("no role may do nothing", () => {
  assert.equal(mayModeratePlatform(null), false);
  assert.equal(mayAdministerPlatform(null), false);
});

test("administrator is a superset of moderator", () => {
  assert.equal(mayModeratePlatform("moderator"), true);
  assert.equal(mayModeratePlatform("administrator"), true);

  assert.equal(mayAdministerPlatform("moderator"), false);
  assert.equal(mayAdministerPlatform("administrator"), true);
});

test("every role the database allows is answered for", () => {
  // A role added to the enum without a decision here would otherwise default to "may not",
  // silently, wherever it was granted.
  for (const role of PLATFORM_ROLES) {
    assert.equal(
      mayModeratePlatform(role) || mayAdministerPlatform(role),
      true,
      `${role} can do nothing at all — is it handled?`,
    );
  }
});
