import { assertEquals, assertExists, assertNotEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  SAME_ORIGIN,
} from "@/src/test/support.ts";
import app from "@/src/app.ts";
import { sessionCookie } from "@/src/test/auth.ts";

// `registerUser` verifies the address as well; these routes sit behind the strict middleware,
// which refuses an unverified member with 403.
const username = "route-sessions-user";
const password = "a-complex-password";

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([username]));

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Signs in with a user agent and an address, the way a browser behind the proxy would. */
async function signIn(userAgent: string, address: string): Promise<string> {
  const response = await app.request("/api/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": userAgent,
      "x-forwarded-for": address,
    },
    body: JSON.stringify({ login: username, password }),
  });
  assertEquals(response.status, STATUS_CODE.OK);
  return sessionCookie(response);
}

const listSessions = (cookie: string) =>
  app.request("/api/auth/sessions", { headers: { cookie } });

type ParsedSession = {
  browser: string | null;
  operatingSystem: string | null;
  deviceType: string | null;
  vendor: string | null;
};

Deno.test("GET /api/auth/sessions parses each user agent and marks the one asking", async () => {
  await registerUser(username);
  const phone = await signIn(IPHONE, "203.0.113.7");
  const desktop = await signIn(WINDOWS, "198.51.100.42");

  const { results } = await (await listSessions(desktop)).json();

  // Three: the one registering opened, plus the two signed in above.
  assertEquals(results.length, 3);

  const parsed = results.map((session: ParsedSession) =>
    `${session.browser}/${session.operatingSystem}/${session.deviceType}/${session.vendor}`
  );
  assertEquals(parsed.includes("Safari/iOS/mobile/Apple"), true);
  assertEquals(parsed.includes("Chrome/Windows/null/null"), true);

  const current = results.filter((session: { current: boolean }) =>
    session.current
  );
  assertEquals(current.length, 1);
  assertEquals(current[0].browser, "Chrome");
  assertEquals(current[0].operatingSystem, "Windows");
  // Null rather than "desktop": the parser labels only what it can tell apart.
  assertEquals(current[0].deviceType, null);
  assertEquals(current[0].vendor, null);
  assertEquals(current[0].ipAddress, "198.51.100.42");

  // Derived from expiry rather than stored, so it has to be a real timestamp near now.
  assertExists(current[0].lastUsedAt);
  assertNotEquals(Number.isNaN(Date.parse(current[0].lastUsedAt)), true);

  assertEquals(phone.length > 0, true);
});

Deno.test("DELETE /api/auth/sessions/others keeps the session asking and ends the rest", async () => {
  await registerUser(username);
  const phone = await signIn(IPHONE, "203.0.113.7");
  const desktop = await signIn(WINDOWS, "198.51.100.42");

  const response = await app.request("/api/auth/sessions/others", {
    method: "DELETE",
    headers: { cookie: desktop, ...SAME_ORIGIN },
  });
  assertEquals(response.status, STATUS_CODE.OK);

  const { results } = await (await listSessions(desktop)).json();
  assertEquals(results.length, 1);
  assertEquals(results[0].current, true);

  // The phone is out: signing out elsewhere has to actually end the other sessions.
  assertEquals((await listSessions(phone)).status, STATUS_CODE.Unauthorized);
});

Deno.test("DELETE /api/auth/sessions/{id} ends one session", async () => {
  await registerUser(username);
  const phone = await signIn(IPHONE, "203.0.113.7");
  const desktop = await signIn(WINDOWS, "198.51.100.42");

  const { results } = await (await listSessions(desktop)).json();
  const other = results.find((session: { current: boolean }) =>
    !session.current
  );

  const response = await app.request(`/api/auth/sessions/${other.id}`, {
    method: "DELETE",
    headers: { cookie: desktop, ...SAME_ORIGIN },
  });
  assertEquals(response.status, STATUS_CODE.OK);

  const remaining = await (await listSessions(desktop)).json();
  assertEquals(remaining.results.length, 2);
  assertEquals(phone.length > 0, true);
});

Deno.test("DELETE /api/auth/sessions/{id} cannot reach another member's session", async () => {
  await registerUser(username);
  const mine = await signIn(WINDOWS, "198.51.100.42");

  const strangerName = "route-sessions-stranger";
  const theirCookie = await registerUser(strangerName);
  const theirSessions = await (await listSessions(theirCookie)).json();

  try {
    const response = await app.request(
      `/api/auth/sessions/${theirSessions.results[0].id}`,
      { method: "DELETE", headers: { cookie: mine, ...SAME_ORIGIN } },
    );

    // 404, not 403: whether somebody else holds this id is not this member's business.
    assertEquals(response.status, STATUS_CODE.NotFound);
    assertEquals((await listSessions(theirCookie)).status, STATUS_CODE.OK);
  } finally {
    await deleteUsers([strangerName]);
  }
});

Deno.test("GET /api/auth/sessions needs a session", async () => {
  const response = await app.request("/api/auth/sessions");

  assertEquals(response.status, STATUS_CODE.Unauthorized);
});
