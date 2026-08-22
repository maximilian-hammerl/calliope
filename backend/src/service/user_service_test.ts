import { assertEquals, assertExists } from "@std/assert";
import { db } from "@/src/database/client.ts";
import { UserService } from "./user_service.ts";

const username = "username";
const password = "a-complex-password";
const emailAddress = "user@example.com";

Deno.test.afterEach(async () => {
  await db.deleteFrom("user").where("username", "=", username).execute();
});

Deno.test("Register and login user", async () => {
  const registeredUser = await UserService.insertUser(
    username,
    password,
    emailAddress,
  );
  assertExists(registeredUser);

  const loggedInUser = await UserService.selectUser(username, password);
  assertExists(loggedInUser);
});

Deno.test("Register same user twice", async () => {
  const registeredUser = await UserService.insertUser(
    username,
    password,
    emailAddress,
  );
  assertExists(registeredUser);

  const alreadyRegisteredUser = await UserService.insertUser(
    username,
    password,
    emailAddress,
  );
  assertEquals(alreadyRegisteredUser, undefined);
});

Deno.test("Verify token for user", async () => {
  const registeredUser = await UserService.insertUser(
    username,
    password,
    emailAddress,
  );
  assertExists(registeredUser);

  const sessionToken = await UserService.insertSessionForUser(
    registeredUser,
    { userAgent: undefined, ipAddress: undefined },
  );
  assertExists(sessionToken);

  const userForToken = await UserService.selectUserForSession(
    sessionToken,
  );
  assertExists(userForToken);
});

Deno.test("Delete session with the matching token", async () => {
  const registeredUser = await UserService.insertUser(
    username,
    password,
    emailAddress,
  );
  assertExists(registeredUser);

  const userSession = await UserService.insertSessionForUser(registeredUser, {
    userAgent: undefined,
    ipAddress: undefined,
  });

  assertEquals(await UserService.deleteSession(userSession), true);
  assertEquals(await UserService.selectUserForSession(userSession), undefined);
});

Deno.test("Keep session when the token does not match", async () => {
  const registeredUser = await UserService.insertUser(
    username,
    password,
    emailAddress,
  );
  assertExists(registeredUser);

  const userSession = await UserService.insertSessionForUser(registeredUser, {
    userAgent: undefined,
    ipAddress: undefined,
  });

  // Knowing the session id must not be enough to end somebody else's session.
  const forged = { id: userSession.id, token: crypto.randomUUID() };
  assertEquals(await UserService.deleteSession(forged), false);

  assertExists(await UserService.selectUserForSession(userSession));
});
