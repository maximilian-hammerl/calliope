import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import app from "@/src/app.ts";
import { db } from "@/src/database/client.ts";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
} from "@/src/test/support.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import {
  deleteAllMail,
  tokenFromMail,
  waitForMail,
} from "@/src/test/mailpit.ts";
import { postJson, sendJson } from "@/src/test/auth.ts";

const username = "password-change-test-user";
const emailAddress = `${username}@example.com`;
const currentPassword = "a-complex-password";
const newPassword = "an-entirely-different-password";

Deno.test.beforeEach(async () => {
  await clearRateLimits();
  await deleteAllMail();
});
Deno.test.afterEach(() => deleteUsers([username]));

async function signedIn(): Promise<string> {
  const cookie = await registerUser(username);
  await flushBackgroundWork();
  await deleteAllMail();
  return cookie;
}

const changePassword = (
  cookie: string,
  from: string = currentPassword,
  to: string = newPassword,
) =>
  sendJson("PATCH", "/api/auth/password", {
    currentPassword: from,
    newPassword: to,
  }, cookie);

const login = (password: string) =>
  postJson("/api/auth/login", { login: username, password });

Deno.test("PATCH /api/auth/password replaces the password", async () => {
  const cookie = await signedIn();

  assertEquals((await changePassword(cookie)).status, STATUS_CODE.OK);

  assertEquals((await login(newPassword)).status, STATUS_CODE.OK);
  assertEquals((await login(currentPassword)).status, STATUS_CODE.Unauthorized);
});

Deno.test("PATCH /api/auth/password refuses a wrong current password", async () => {
  const cookie = await signedIn();

  const response = await changePassword(cookie, "not-the-password");

  // The point of asking: a session that was not the member's must not be able to lock them out.
  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertEquals((await login(currentPassword)).status, STATUS_CODE.OK);
});

Deno.test("PATCH /api/auth/password keeps this session and ends the others", async () => {
  const cookie = await signedIn();

  const other = await login(currentPassword);
  const otherCookie = other.headers.get("set-cookie")!.split(";")[0];
  assertEquals(
    (await app.request("/api/auth/me", { headers: { cookie: otherCookie } }))
      .status,
    STATUS_CODE.OK,
  );

  await changePassword(cookie);

  // The tab doing the work survives; everything else is evicted.
  assertEquals(
    (await app.request("/api/auth/me", { headers: { cookie } })).status,
    STATUS_CODE.OK,
  );
  assertEquals(
    (await app.request("/api/auth/me", { headers: { cookie: otherCookie } }))
      .status,
    STATUS_CODE.Unauthorized,
  );
});

Deno.test("PATCH /api/auth/password kills an outstanding reset link", async () => {
  const cookie = await signedIn();

  await postJson("/api/auth/forgot-password", { login: username });
  await flushBackgroundWork();
  const resetToken = tokenFromMail(await waitForMail(emailAddress));
  await deleteAllMail();

  await changePassword(cookie);

  // Otherwise a link requested earlier could still hand the account to whoever holds it.
  const reset = await postJson("/api/auth/reset-password", {
    token: resetToken,
    password: "a-third-password",
  });
  assertEquals(reset.status, STATUS_CODE.Gone);
  assertEquals((await login(newPassword)).status, STATUS_CODE.OK);
});

Deno.test("PATCH /api/auth/password writes to the member", async () => {
  const cookie = await signedIn();

  await changePassword(cookie);
  await flushBackgroundWork();

  // A password changed behind somebody's back must not happen quietly.
  assertEquals((await waitForMail(emailAddress)).to, emailAddress);
});

Deno.test("PATCH /api/auth/password needs a session", async () => {
  const response = await sendJson("PATCH", "/api/auth/password", {
    currentPassword,
    newPassword,
  });

  assertEquals(response.status, STATUS_CODE.Unauthorized);
});

Deno.test("PATCH /api/auth/password is refused while the address is unverified", async () => {
  const cookie = await signedIn();

  await db
    .updateTable("user")
    .set({ emailVerifiedAt: null })
    .where("username", "=", username)
    .execute();

  assertEquals((await changePassword(cookie)).status, STATUS_CODE.Forbidden);
});
