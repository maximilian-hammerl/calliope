import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { Hono } from "hono";
import { db } from "@/src/database/client.ts";
import { type User, UserService } from "@/src/service/user_service.ts";
import authenticated from "./authenticated.ts";
import authenticatedAllowingUnverifiedEmailAddress from "./authenticated_allowing_unverified_email_address.ts";

const username = "require-session-test-user";
const password = "a-complex-password";
const emailAddress = "require-session-test-user@example.com";

// A bare app, so the test exercises the middleware rather than a route that happens to use it.
const app = new Hono<{ Variables: { user: User } }>()
  .use(authenticated)
  .get("/probe", (c) => c.json({ username: c.get("user").username }));

const permissiveApp = new Hono<{ Variables: { user: User } }>()
  .use(authenticatedAllowingUnverifiedEmailAddress)
  .get("/probe", (c) => c.json({ username: c.get("user").username }));

async function createUserWithSession({ verified = true } = {}) {
  const user = await UserService.insertUser(username, password, emailAddress);
  assertExists(user, "fixture user could not be created");

  // Registering leaves the address unverified, which every gated route now refuses, so the
  // ordinary fixture confirms it and the unverified case is asked for explicitly.
  if (verified) {
    await db
      .updateTable("user")
      .set({ emailAddressVerifiedAt: Temporal.Now.instant().toString() })
      .where("id", "=", user.id)
      .execute();
  }

  // No request to read provenance from: this drives the service directly.
  const session = await UserService.insertSessionForUser(user, {
    userAgent: undefined,
    ipAddress: undefined,
  });
  return { user, session };
}

Deno.test.afterEach(async () => {
  await db.deleteFrom("user").where("username", "=", username).execute();
});

Deno.test("authenticated passes a valid session through to the handler", async () => {
  const { session } = await createUserWithSession();

  const response = await app.request("/probe", {
    headers: { cookie: `session=${session.id}.${session.token}` },
  });

  assertEquals(response.status, STATUS_CODE.OK);
  // The handler only sees a username because the middleware resolved and set the user.
  assertEquals(await response.json(), { username });
});

Deno.test("authenticated rejects a forged token for a real session", async () => {
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

Deno.test("authenticated refuses a session whose address is unverified", async () => {
  const { session } = await createUserWithSession({ verified: false });

  const response = await app.request("/probe", {
    headers: { cookie: `session=${session.id}.${session.token}` },
  });

  // 403, not 401: the session is perfectly good, and answering "unauthorised" would send the
  // member back to the sign-in page they just came from.
  assertEquals(response.status, STATUS_CODE.Forbidden);
  assertEquals(await response.json(), { error: "Email address not verified" });
});

Deno.test("the permissive middleware lets an unverified session through", async () => {
  const { session } = await createUserWithSession({ verified: false });

  // Without it there is no way to correct a mistyped address, and a typo orphans the account.
  const response = await permissiveApp.request("/probe", {
    headers: { cookie: `session=${session.id}.${session.token}` },
  });

  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals(await response.json(), { username });
});
