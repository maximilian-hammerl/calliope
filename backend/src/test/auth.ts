import { assertExists } from "@std/assert";
import app from "@/src/app.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import { deleteAllMail } from "@/src/test/mailpit.ts";

/**
 * What the auth tests share. They cannot use `test/support.ts`'s `registerUser` and `request`,
 * because registering and sending a session *is* what they are testing — these go through the
 * app by hand so a malformed body or a missing cookie can be exercised.
 */
export const username = "route-test-user";
export const password = "a-complex-password";
export const emailAddress = "route-test-user@example.com";

export function sendJson(
  method: string,
  path: string,
  body?: unknown,
  cookie?: string,
) {
  return app.request(path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(cookie === undefined ? {} : { cookie }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const postJson = (path: string, body?: unknown, cookie?: string) =>
  sendJson("POST", path, body, cookie);

export const register = () =>
  postJson("/api/auth/register", { username, password, emailAddress });

/** Returns the `session=...` pair of a Set-Cookie header, ready to send back. */
export function sessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assertExists(setCookie, "expected the response to set a session cookie");
  return setCookie.split(";")[0] ?? setCookie;
}

/**
 * Registers, then drops the verification mail registering sends. Both mails go to the same
 * address, so a test asserting on messages would otherwise count — or read the link out of —
 * the wrong one.
 */
export async function registerAndDiscardVerificationMail(): Promise<Response> {
  const response = await register();
  await flushBackgroundWork();
  await deleteAllMail();
  return response;
}
