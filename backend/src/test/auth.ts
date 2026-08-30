import { assertExists } from "@std/assert";
import app from "@/src/app.ts";
import { flushBackgroundWork } from "@/src/util/background.ts";
import { countMailFor, deleteMailFor } from "@/src/test/mailpit.ts";
import "@/src/test/breach_check.ts";

/**
 * What the auth tests share. They cannot use `test/support.ts`'s `registerUser` and `request`,
 * because registering and sending a session *is* what they are testing — these go through the
 * app by hand so a malformed body or a missing cookie can be exercised.
 */
export const password = "a-complex-password";

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

/** Returns the `session=...` pair of a Set-Cookie header, ready to send back. */
export function sessionCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assertExists(setCookie, "expected the response to set a session cookie");
  return setCookie.split(";")[0] ?? setCookie;
}

/**
 * One account per test file, named by `scope`. A single shared `route-test-user` meant every
 * auth test registered the same name, so two files running at once answered each other's
 * requests with 409s and deleted each other's account.
 */
export function authFixture(scope: string, ...alsoWrites: string[]) {
  const username = `route-${scope}-user`;
  const emailAddress = `${username}@example.com`;
  /** Its own mailbox: `deleteAllMail` empties everyone's, including a message another file waits for. */
  const addresses = [emailAddress, ...alsoWrites];
  const clearMail = () => deleteMailFor(addresses);
  const mailCount = () => countMailFor(addresses);

  const register = () =>
    postJson("/api/auth/register", { username, password, emailAddress });

  /**
   * Registers, then drops the verification mail registering sends. Both mails go to the same
   * address, so a test asserting on messages would otherwise count — or read the link out of
   * — the wrong one.
   */
  async function registerAndDiscardVerificationMail(): Promise<Response> {
    const response = await register();
    await flushBackgroundWork();
    await clearMail();
    return response;
  }

  return {
    username,
    emailAddress,
    clearMail,
    mailCount,
    register,
    registerAndDiscardVerificationMail,
  };
}
