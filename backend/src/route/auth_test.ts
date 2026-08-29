import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import app from "@/src/app.ts";
import {
  clearRateLimits,
  deleteUsers,
  SAME_ORIGIN,
} from "@/src/test/support.ts";
import { authFixture, password } from "@/src/test/auth.ts";
import { UPLOAD_BODY_LIMIT_BYTES } from "@/src/text_limit.ts";

// Its own account, so a file running beside this one cannot register or delete it.
const { emailAddress, username } = authFixture("body-limit");

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

async function upload(bytes: number): Promise<Response> {
  const form = new FormData();
  form.append(
    "image",
    new File([new Uint8Array(bytes)], "a.png", { type: "image/png" }),
  );
  form.append("origin", "own_work");
  form.append("confirmed", "true");
  return await app.request("/api/users/me/avatar", {
    method: "PUT",
    headers: SAME_ORIGIN,
    body: form,
  });
}

/**
 * The one path allowed a larger body. It is chosen in `app.ts` rather than declared on the route,
 * because this middleware runs first and a limit written on the route never executes — so what is
 * pinned here is that the choice is actually reaching the right requests.
 *
 * Unauthenticated on purpose: the body limit runs before the session check, so a 401 is proof the
 * body was *not* refused for its size.
 */
Deno.test("an upload may be larger than every other body", async () => {
  const response = await upload(2 * 1_048_576);
  assertEquals(response.status, STATUS_CODE.Unauthorized);
});

Deno.test("an upload beyond even that limit is refused", async () => {
  const response = await upload(UPLOAD_BODY_LIMIT_BYTES + 1_048_576);
  assertEquals(response.status, STATUS_CODE.ContentTooLarge);
});
