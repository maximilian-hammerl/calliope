import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { Hono } from "hono";
import { db } from "@/src/database/client.ts";
import { type User, UserService } from "@/src/service/user_service.ts";
import requireSession from "./require_session.ts";

const username = "require-session-test-user";
const password = "a-complex-password";
const emailAddress = "require-session-test-user@example.com";

// A bare app, so the test exercises the middleware rather than a route that happens to use it.
const app = new Hono<{ Variables: { user: User } }>()
  .use(requireSession)
  .get("/probe", (c) => c.json({ username: c.get("user").username }));

async function createUserWithSession() {
  const user = await UserService.insertUser(username, password, emailAddress);
  assertExists(user, "fixture user could not be created");

  const session = await UserService.insertSessionForUser(user);
  return { user, session };
}

Deno.test.afterEach(async () => {
  await db.deleteFrom("user").where("username", "=", username).execute();
});

Deno.test("requireSession passes a valid session through to the handler", async () => {
  const { session } = await createUserWithSession();

  const response = await app.request("/probe", {
    headers: { cookie: `session=${session.id}.${session.token}` },
  });

  assertEquals(response.status, STATUS_CODE.OK);
  // The handler only sees a username because the middleware resolved and set the user.
  assertEquals(await response.json(), { username });
});

Deno.test("requireSession rejects a forged token for a real session", async () => {
  const { session } = await createUserWithSession();

  // The session id is real; only the token is wrong. Knowing an id must not be enough.
  const response = await app.request("/probe", {
    headers: { cookie: `session=${session.id}.${crypto.randomUUID()}` },
  });

  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertEquals(await response.json(), { error: "Unauthorized" });

  // The unusable cookie is cleared rather than left for the browser to keep sending.
  const setCookie = response.headers.get("set-cookie");
  assertExists(setCookie);
  assertStringIncludes(setCookie, "session=;");
});
