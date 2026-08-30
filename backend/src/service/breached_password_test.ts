import { assertEquals } from "@std/assert";
import app from "@/src/app.ts";
import {
  clearRateLimits,
  deleteUsers,
  UNREACHABLE_BREACH_CHECK,
} from "@/src/test/support.ts";
import { PASSWORD_BREACHED } from "@/src/http/response.ts";
import { isBreached, parseRange } from "./breached_password.ts";

// SHA1("password") = 5BAA6 1E4C9B93F3F0682250B6CF8331B7EE68FD8, as the API returned it.
const PASSWORD_SUFFIX = "1E4C9B93F3F0682250B6CF8331B7EE68FD8";

/** Shaped like the real answer: CRLF, with a padded entry among the real ones. */
const BODY = [
  "003CD215739D7C1B2218670D26F81408237:2",
  `${PASSWORD_SUFFIX}:52372427`,
  "0164EC3D5F2C6B4E4B5F4C1B9D3F7A8C9D0:0",
].join("\r\n");

Deno.test("a suffix in the answer is a breach", () => {
  assertEquals(parseRange(BODY, PASSWORD_SUFFIX), true);
});

Deno.test("a suffix that is not there is not", () => {
  assertEquals(parseRange(BODY, "F".repeat(35)), false);
});

/** The one that matters: a padded entry is not a leak. */
Deno.test("a padded entry is not a breach", () => {
  assertEquals(parseRange(BODY, "0164EC3D5F2C6B4E4B5F4C1B9D3F7A8C9D0"), false);
});

Deno.test("the answer is CRLF, so the count must survive the line ending", () => {
  assertEquals(parseRange(`${PASSWORD_SUFFIX}:2\r\n`, PASSWORD_SUFFIX), true);
});

Deno.test("a malformed line is passed over rather than thrown on", () => {
  const body = `nonsense\r\n\r\n:::\r\n${PASSWORD_SUFFIX}:7`;
  assertEquals(parseRange(body, PASSWORD_SUFFIX), true);
  assertEquals(parseRange("nonsense\r\n", PASSWORD_SUFFIX), false);
});

Deno.test("the API answers in upper case, and so does the hash", () => {
  assertEquals(
    parseRange(`${PASSWORD_SUFFIX.toLowerCase()}:9`, PASSWORD_SUFFIX),
    true,
  );
});

/** Nothing is listening on port 1, so this is the outage without a server to arrange one. */
Deno.test("an unreachable service lets the password through", async () => {
  assertEquals(await isBreached("password"), false);
});

/** What the pure tests cannot see: that the five sent and the thirty-five kept are not swapped. */
Deno.test("the prefix is sent and the suffix is matched", async () => {
  const asked: string[] = [];
  const server = Deno.serve({ port: 0, onListen: () => {} }, (request) => {
    const prefix = new URL(request.url).pathname.split("/").at(-1) ?? "";
    asked.push(prefix);
    // Answers only for the prefix of SHA1("password"), and pads the rest.
    return new Response(
      prefix === "5BAA6"
        ? `${PASSWORD_SUFFIX}:52372427\r\n0164EC3D5F2C6B4E4B5F4C1B9D3F7A8C9D0:0\r\n`
        : "0164EC3D5F2C6B4E4B5F4C1B9D3F7A8C9D0:0\r\n",
    );
  });
  Deno.env.set("PWNED_PASSWORDS_URL", `http://localhost:${server.addr.port}`);

  try {
    assertEquals(await isBreached("password"), true);
    assertEquals(await isBreached("a-password-nobody-has-leaked-yet"), false);
    assertEquals(asked[0], "5BAA6");
    // Five out, thirty-five kept: a prefix of any other length would be the halves misplaced.
    assertEquals(asked.every((prefix) => prefix.length === 5), true);

    // And the route refuses it, which is the whole point of knowing.
    await clearRateLimits();
    const username = "breached-password-user";
    const response = await app.request("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username,
        emailAddress: `${username}@example.test`,
        password: "password",
      }),
    });

    assertEquals(response.status, 422);
    assertEquals((await response.json()).code, PASSWORD_BREACHED);
    // Refused on the way in, so nothing was created.
    await deleteUsers([username]);
  } finally {
    Deno.env.set("PWNED_PASSWORDS_URL", UNREACHABLE_BREACH_CHECK);
    await server.shutdown();
  }
});
