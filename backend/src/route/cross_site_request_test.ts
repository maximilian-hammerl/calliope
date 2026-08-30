import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import app from "@/src/app.ts";
import { getRequiredEnvVariable } from "@/src/util/env.ts";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  SAME_ORIGIN,
} from "@/src/test/support.ts";

const USER = "cross-site-probe";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([USER]));

const GROUP = { title: "t", synopsis: "s", visibility: "private" };

/**
 * The session cookie is `SameSite=Lax`, which a same-site subdomain and a top-level GET can both
 * carry — so what stops a forged write is that every state-changing route requires
 * `application/json`, a type no form can produce and no `fetch` can send without a preflight.
 */
Deno.test("a write refuses every body a cross-site request could send", async () => {
  const cookie = await registerUser(USER);
  const body = JSON.stringify(GROUP);

  // The three a form may set, plus `text/plain` carrying valid JSON — the one that needs no
  // preflight and would otherwise be smuggled straight past the schema.
  for (
    const contentType of [
      "application/x-www-form-urlencoded",
      "multipart/form-data; boundary=x",
      "text/plain",
    ]
  ) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    const response = await app.request("/api/groups", {
      method: "POST",
      headers: { cookie, "content-type": contentType, ...SAME_ORIGIN },
      body,
    });

    assertEquals(
      response.status,
      STATUS_CODE.BadRequest,
      `${contentType} reached the handler`,
    );
  }
});

/** The control: the same body the interface sends is accepted, so the test above proves something. */
Deno.test("the same write succeeds as JSON", async () => {
  const cookie = await registerUser(USER);
  const response = await app.request("/api/groups", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ ...GROUP, title: "real" }),
  });

  assertEquals(response.status, STATUS_CODE.Created);
});

function forgeable(cookie: string, headers: Record<string, string>) {
  // A form body: the one shape a cross-site page can send without a preflight, and so the only
  // one `csrf()` inspects.
  return app.request("/api/groups", {
    method: "POST",
    headers: {
      cookie,
      "content-type": "multipart/form-data; boundary=x",
      ...headers,
    },
    body: "--x--",
  });
}

/**
 * `SameSite=Lax` calls a sibling subdomain same-site and sends it the cookie; `Sec-Fetch-Site` is
 * the only thing that tells the two apart, and script cannot set it.
 */
Deno.test("a forgeable write is refused from anywhere but this origin", async () => {
  const cookie = await registerUser(USER);

  for (const site of ["cross-site", "same-site", "none"]) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    const response = await forgeable(cookie, { "sec-fetch-site": site });
    assertEquals(response.status, STATUS_CODE.Forbidden, `${site} was allowed`);
  }
});

/** Neither signal: the shape a cross-site page sends when the browser is too old for either. */
Deno.test("a forgeable write is refused when it proves no origin at all", async () => {
  const cookie = await registerUser(USER);
  const response = await forgeable(cookie, {});

  assertEquals(response.status, STATUS_CODE.Forbidden);
  // `csrf()` throws with a response and no message, which reaches the client as an empty error
  // unless `onError` names the status itself.
  assertEquals((await response.json()).error, "Forbidden");
});

/** Safari sent no `Sec-Fetch-Site` before 16.4, so `Origin` alone has to be enough. */
Deno.test("a forgeable write is allowed on Origin alone", async () => {
  const cookie = await registerUser(USER);
  const response = await forgeable(cookie, {
    origin: getRequiredEnvVariable("HOST_URL"),
  });

  // Past the guard and refused by the schema instead, which is the next line of defence.
  assertEquals(response.status, STATUS_CODE.BadRequest);
});

Deno.test("a forgeable write is allowed from this origin", async () => {
  const cookie = await registerUser(USER);
  const response = await forgeable(cookie, SAME_ORIGIN);

  assertEquals(response.status, STATUS_CODE.BadRequest);
});

/** Reads are untouched, and a cross-site read still cannot be *read* — CORS sees to that. */
Deno.test("a read is not refused by origin", async () => {
  const cookie = await registerUser(USER);
  const response = await app.request("/api/auth/me", {
    headers: { cookie, "sec-fetch-site": "cross-site" },
  });
  assertEquals(response.status, STATUS_CODE.OK);
});

/** The ordering trap: a preflight is `cross-site` by nature and must reach `cors`, not this. */
Deno.test("a CORS preflight still succeeds", async () => {
  const response = await app.request("/api/groups", {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:5176",
      "sec-fetch-site": "cross-site",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
  assertEquals(
    response.status < 400,
    true,
    `preflight answered ${response.status}`,
  );
});
