import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "#/src/http/status.ts";
import app from "#/src/app.ts";
import { clearRateLimits, deleteUsers } from "#/src/test/support.ts";
import { authFixture, sessionCookie } from "#/src/test/auth.ts";

// Its own account, so a file running beside this one cannot register or delete it.
const { emailAddress, register, username } = authFixture("me");

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([username]));

test("GET /api/auth/me reports the signed-in user", async () => {
  const cookie = sessionCookie(await register());

  const response = await app.request("/api/auth/me", { headers: { cookie } });

  assert.equal(response.status, STATUS_CODE.OK);
  const body = await response.json();
  assert.equal(body.username, username);
  assert.equal(body.emailAddress, emailAddress);
  // The password hash must not leak through the response schema.
  assert.deepEqual(Object.keys(body).toSorted(), [
    "avatarUrl",
    "emailAddress",
    "emailAddressVerifiedAt",
    "id",
    "platformRole",
    "unreadNotifications",
    "username",
  ]);
  assert.equal(body.unreadNotifications, 0);
  // Null for an ordinary member, which is what a freshly registered account is.
  assert.equal(body.platformRole, null);
});

test("GET /api/auth/me rejects a request without a session", async () => {
  const response = await app.request("/api/auth/me");

  assert.equal(response.status, STATUS_CODE.Unauthorized);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
});

test("GET /api/auth/me treats a malformed session cookie as no session", async () => {
  // The id half reaches a uuid column. Passing it through unchecked made every request with
  // a corrupted cookie answer 500 rather than simply being unauthenticated.
  for (const cookie of [
    "session=abc",
    "session=abc.def",
    "session=.only-a-secret",
    "session=01a019ee-ab02-7a82-9796-3767b50ed584",
  ]) {
    // oxlint-disable-next-line no-await-in-loop -- sequential on purpose, one case per iteration
    const response = await app.request("/api/auth/me", { headers: { cookie } });

    assert.equal(
      response.status,
      STATUS_CODE.Unauthorized,
      `expected ${cookie} to be unauthorised`,
    );
    // oxlint-disable-next-line no-await-in-loop -- sequential on purpose, one case per iteration
    await response.body?.cancel();
  }
});
