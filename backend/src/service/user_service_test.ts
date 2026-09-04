import { assertEquals, assertExists } from "@std/assert";
import { write } from "@/src/test/support.ts";
import { UserService } from "./user_service.ts";

const username = "username";
const password = "a-complex-password";
const emailAddress = "user@example.com";

Deno.test.afterEach(async () => {
  await write((transaction) =>
    transaction
      .deleteFrom("user").where("username", "=", username).execute()
  );
});

Deno.test("Register and login user", async () => {
  const registeredUser = await write((transaction) =>
    UserService.insertUser(transaction, username, password, emailAddress)
  );
  assertExists(registeredUser);

  const loggedInUser = await UserService.selectUser(username, password);
  assertExists(loggedInUser);
});

Deno.test("Register same user twice", async () => {
  const registeredUser = await write((transaction) =>
    UserService.insertUser(
      transaction,
      username,
      password,
      emailAddress,
    )
  );
  assertExists(registeredUser);

  const alreadyRegisteredUser = await write((transaction) =>
    UserService.insertUser(
      transaction,
      username,
      password,
      emailAddress,
    )
  );
  assertEquals(alreadyRegisteredUser, undefined);
});

Deno.test("Verify token for user", async () => {
  const registeredUser = await write((transaction) =>
    UserService.insertUser(
      transaction,
      username,
      password,
      emailAddress,
    )
  );
  assertExists(registeredUser);

  const sessionToken = await write((transaction) =>
    UserService.insertSessionForUser(
      transaction,
      registeredUser,
      { userAgent: undefined, ipAddress: undefined },
    )
  );
  assertExists(sessionToken);

  const userForToken = await UserService.selectUserForSession(
    sessionToken,
  );
  assertExists(userForToken);
});

Deno.test("Delete session with the matching token", async () => {
  const registeredUser = await write((transaction) =>
    UserService.insertUser(
      transaction,
      username,
      password,
      emailAddress,
    )
  );
  assertExists(registeredUser);

  const userSession = await write((transaction) =>
    UserService.insertSessionForUser(
      transaction,
      registeredUser,
      {
        userAgent: undefined,
        ipAddress: undefined,
      },
    )
  );

  assertEquals(
    await write((transaction) =>
      UserService.deleteSession(transaction, userSession)
    ),
    true,
  );
  assertEquals(await UserService.selectUserForSession(userSession), undefined);
});

Deno.test("Keep session when the token does not match", async () => {
  const registeredUser = await write((transaction) =>
    UserService.insertUser(
      transaction,
      username,
      password,
      emailAddress,
    )
  );
  assertExists(registeredUser);

  const userSession = await write((transaction) =>
    UserService.insertSessionForUser(
      transaction,
      registeredUser,
      {
        userAgent: undefined,
        ipAddress: undefined,
      },
    )
  );

  // Knowing the session id must not be enough to end somebody else's session.
  const forged = { id: userSession.id, token: crypto.randomUUID() };
  assertEquals(
    await write((transaction) =>
      UserService.deleteSession(transaction, forged)
    ),
    false,
  );

  assertExists(await UserService.selectUserForSession(userSession));
});
