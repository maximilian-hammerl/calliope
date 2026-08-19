import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import app from "@/src/app.ts";
import { clearRateLimits, deleteUsers } from "@/src/test/support.ts";
import { emailAddress, password, username } from "@/src/test/auth.ts";

/**
 * What is left once each route's own behaviour moved next to it: this is about the app's body
 * limit rather than about registering, and it happens to use the register route because that
 * is the simplest way in.
 */
Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([username]));

Deno.test("a body beyond the limit is refused before it is parsed", async () => {
  // Previously this was stored: a 20 MB post reached the database intact.
  const response = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "x".repeat(2_000_000),
      password,
      emailAddress,
    }),
  });

  assertEquals(response.status, STATUS_CODE.ContentTooLarge);
  assertEquals(await response.json(), { error: "Request body too large" });
});
