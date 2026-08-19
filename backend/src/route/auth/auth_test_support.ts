import { assertExists } from "@std/assert";
import app from "@/src/app.ts";

/**
 * What the auth tests share. They cannot use `test_support.ts`'s `registerUser` and `request`,
 * because registering and sending a session *is* what they are testing — these go through the
 * app by hand so a malformed body or a missing cookie can be exercised.
 *
 * Not named `*_test.ts`, so the runner does not collect it as a test file of its own.
 */
export const username = "route-test-user";
export const password = "a-complex-password";
export const emailAddress = "route-test-user@example.com";

export function postJson(path: string, body?: unknown, cookie?: string) {
  return app.request(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie === undefined ? {} : { cookie }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const register = () =>
  postJson("/api/auth/register", { username, password, emailAddress });

/** Returns the `session=...` pair of a Set-Cookie header, ready to send back. */
export function sessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assertExists(setCookie, "expected the response to set a session cookie");
  return setCookie.split(";")[0];
}
