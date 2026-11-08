import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { write } from "@/src/test/support.ts";
import { UserService } from "./user_service.ts";

const username = "username";
const password = "a-complex-password";
const emailAddress = "user@example.com";

afterEach(async () => {
  await write((transaction) =>
    transaction
      .deleteFrom("user").where("username", "=", username).execute()
  );
});

test("Register and login user", async () => {
  const registeredUser = await write((transaction) =>
    UserService.insertUser(transaction, username, password, emailAddress)
  );
  assert.ok(registeredUser);

  const loggedInUser = await UserService.selectUser(username, password);
  assert.ok(loggedInUser);
});

test("Register same user twice", async () => {
  const registeredUser = await write((transaction) =>
    UserService.insertUser(
      transaction,
      username,
      password,
      emailAddress,
    )
  );
  assert.ok(registeredUser);

  const alreadyRegisteredUser = await write((transaction) =>
    UserService.insertUser(
      transaction,
      username,
      password,
      emailAddress,
    )
  );
  assert.equal(alreadyRegisteredUser, undefined);
});

test("Verify token for user", async () => {
  const registeredUser = await write((transaction) =>
    UserService.insertUser(
      transaction,
      username,
      password,
      emailAddress,
    )
  );
  assert.ok(registeredUser);

  const sessionToken = await write((transaction) =>
    UserService.insertSessionForUser(
      transaction,
      registeredUser,
      { userAgent: undefined, ipAddress: undefined },
    )
  );
  assert.ok(sessionToken);

  const userForToken = await UserService.selectUserForSession(
    sessionToken,
  );
  assert.ok(userForToken);
});

test("Delete session with the matching token", async () => {
  const registeredUser = await write((transaction) =>
    UserService.insertUser(
      transaction,
      username,
      password,
      emailAddress,
    )
  );
  assert.ok(registeredUser);

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

  assert.equal(
    await write((transaction) =>
      UserService.deleteSession(transaction, userSession)
    ),
    true,
  );
  assert.equal(await UserService.selectUserForSession(userSession), undefined);
});

test("Keep session when the token does not match", async () => {
  const registeredUser = await write((transaction) =>
    UserService.insertUser(
      transaction,
      username,
      password,
      emailAddress,
    )
  );
  assert.ok(registeredUser);

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
  assert.equal(
    await write((transaction) =>
      UserService.deleteSession(transaction, forged)
    ),
    false,
  );

  assert.ok(await UserService.selectUserForSession(userSession));
});
