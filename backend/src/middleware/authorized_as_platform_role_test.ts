import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { Hono } from "hono";
import { db } from "@/src/database/client.ts";
import type { PlatformRole } from "@/src/database/schema.ts";
import { type User, UserService } from "@/src/service/user_service.ts";
import authenticated from "./authenticated.ts";
import {
  authorizedAsAdministrator,
  authorizedAsModerator,
} from "./authorized_as_platform_role.ts";

// Its own account, because the suite runs in parallel and a shared name collides.
const username = "require-platform-role-test-user";
const password = "a-complex-password";
const emailAddress = "require-platform-role-test-user@example.com";

// Bare apps, so these exercise the middleware rather than a route that happens to use it.
const probe = (authorization: typeof authorizedAsModerator) =>
  new Hono<{ Variables: { user: User } }>()
    .use(authenticated)
    .use(authorization)
    .get("/probe", (c) => c.json({ username: c.get("user").username }));

/** Authorization with no authentication in front of it, which a route should never do. */
const unguardedApp = new Hono<{ Variables: { user: User } }>()
  .use(authorizedAsModerator)
  .get("/probe", (c) => c.json({ username: c.get("user").username }));

const moderatorApp = probe(authorizedAsModerator);
const administratorApp = probe(authorizedAsAdministrator);

async function createUserWithSession(platformRole: PlatformRole | null) {
  const user = await UserService.insertUser(username, password, emailAddress);
  assertExists(user, "fixture user could not be created");

  await db
    .updateTable("user")
    .set({
      emailAddressVerifiedAt: Temporal.Now.instant().toString(),
      platformRole,
    })
    .where("id", "=", user.id)
    .execute();

  const session = await UserService.insertSessionForUser(user, {
    userAgent: undefined,
    ipAddress: undefined,
  });
  return `session=${session.id}.${session.token}`;
}

Deno.test.afterEach(async () => {
  await db.deleteFrom("user").where("username", "=", username).execute();
});

async function statusFor(
  app: typeof moderatorApp,
  platformRole: PlatformRole | null,
): Promise<number> {
  const cookie = await createUserWithSession(platformRole);
  const response = await app.request("/probe", { headers: { cookie } });
  await response.body?.cancel();
  return response.status;
}

Deno.test("authorizedAsModerator lets a moderator through", async () => {
  assertEquals(await statusFor(moderatorApp, "moderator"), STATUS_CODE.OK);
});

Deno.test("authorizedAsModerator lets an administrator through", async () => {
  // The whole point of the pair: administrator is a superset, so every moderator gate opens
  // for one. Nothing else in the codebase would notice if that stopped being true.
  assertEquals(await statusFor(moderatorApp, "administrator"), STATUS_CODE.OK);
});

Deno.test("authorizedAsModerator refuses a member with no role", async () => {
  assertEquals(await statusFor(moderatorApp, null), STATUS_CODE.Forbidden);
});

Deno.test("authorizedAsAdministrator refuses a moderator", async () => {
  // The other half of the superset: a moderator must not reach what only an administrator may.
  assertEquals(
    await statusFor(administratorApp, "moderator"),
    STATUS_CODE.Forbidden,
  );
});

Deno.test("authorizedAsAdministrator lets an administrator through", async () => {
  assertEquals(
    await statusFor(administratorApp, "administrator"),
    STATUS_CODE.OK,
  );
});

Deno.test("authorization alone refuses rather than throwing on an absent user", async () => {
  // Listing an authorizedAs… without an authentication middleware is a mistake, but it must
  // answer 401 rather than 500 on `undefined`.
  const response = await unguardedApp.request("/probe");
  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertEquals(await response.json(), { error: "Unauthorized" });
});

Deno.test("an operator gate refuses when there is no session at all", async () => {
  // 401 rather than 403 here: there is nobody to refuse yet, which is a different answer from
  // "you are signed in and may not".
  const response = await moderatorApp.request("/probe");
  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertEquals(await response.json(), { error: "Unauthorized" });
});

Deno.test("an operator gate refuses an unverified address before the role", async () => {
  const user = await UserService.insertUser(username, password, emailAddress);
  assertExists(user);
  // A role on an account that has never proven its address must not open the gate.
  await db
    .updateTable("user")
    .set({ platformRole: "administrator" })
    .where("id", "=", user.id)
    .execute();

  const session = await UserService.insertSessionForUser(user, {
    userAgent: undefined,
    ipAddress: undefined,
  });

  const response = await moderatorApp.request("/probe", {
    headers: { cookie: `session=${session.id}.${session.token}` },
  });

  assertEquals(response.status, STATUS_CODE.Forbidden);
  assertEquals(await response.json(), { error: "Email address not verified" });
});
