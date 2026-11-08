import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { authFixture, postJson, sessionCookie } from "@/src/test/auth.ts";

// Its own account, so a file running beside this one cannot register or delete it.
const { register, username } = authFixture("logout");

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([username]));

test("POST /api/auth/logout ends an existing session", async () => {
  const cookie = sessionCookie(await register());

  const response = await postJson("/api/auth/logout", undefined, cookie);

  assert.equal(response.status, STATUS_CODE.OK);
  assert.deepEqual(await response.json(), { ok: true });

  // The session is gone, so the same cookie no longer authenticates.
  const reused = await postJson("/api/auth/logout", undefined, cookie);
  assert.equal(reused.status, STATUS_CODE.Unauthorized);
});

test("POST /api/auth/logout rejects a request without a session", async () => {
  const response = await postJson("/api/auth/logout");

  assert.equal(response.status, STATUS_CODE.Unauthorized);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});
