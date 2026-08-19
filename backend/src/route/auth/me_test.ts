import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import app from "@/src/app.ts";
import { clearRateLimits, deleteUsers } from "@/src/test_support.ts";
import {
  emailAddress,
  register,
  sessionCookie,
  username,
} from "./auth_test_support.ts";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([username]));

Deno.test("GET /api/auth/me reports the signed-in user", async () => {
  const cookie = sessionCookie(await register());

  const response = await app.request("/api/auth/me", { headers: { cookie } });

  assertEquals(response.status, STATUS_CODE.OK);
  const body = await response.json();
  assertEquals(body.username, username);
  assertEquals(body.emailAddress, emailAddress);
  // The password hash must not leak through the response schema.
  assertEquals(Object.keys(body).toSorted(), [
    "emailAddress",
    "id",
    "unreadNotifications",
    "username",
  ]);
  assertEquals(body.unreadNotifications, 0);
});

Deno.test("GET /api/auth/me rejects a request without a session", async () => {
  const response = await app.request("/api/auth/me");

  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertEquals(await response.json(), { error: "Unauthorized" });
});
