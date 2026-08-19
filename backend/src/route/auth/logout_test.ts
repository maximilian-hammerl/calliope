import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { clearRateLimits, deleteUsers } from "@/src/test_support.ts";
import {
  postJson,
  register,
  sessionCookie,
  username,
} from "./auth_test_support.ts";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([username]));

Deno.test("POST /api/auth/logout ends an existing session", async () => {
  const cookie = sessionCookie(await register());

  const response = await postJson("/api/auth/logout", undefined, cookie);

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { ok: true });

  // The session is gone, so the same cookie no longer authenticates.
  const reused = await postJson("/api/auth/logout", undefined, cookie);
  assertEquals(reused.status, STATUS_CODE.Unauthorized);
});

Deno.test("POST /api/auth/logout rejects a request without a session", async () => {
  const response = await postJson("/api/auth/logout");

  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertEquals(await response.json(), { error: "Unauthorized" });
});
