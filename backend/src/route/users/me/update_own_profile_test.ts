import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";
import { sendJson } from "@/src/test/auth.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";

const author = "update-profile-test-author";
const reader = "update-profile-test-reader";

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([author, reader]));

Deno.test("PATCH /api/users/me stores the fields and another member reads them", async () => {
  const cookie = await registerUser(author);

  const response = await sendJson("PATCH", "/api/users/me", {
    aboutMe: "Schreibe seit zehn Jahren, meist abends.",
    writingStyle: "Dritte Person, Vergangenheit.",
    writingBoundaries: "Nichts Explizites.",
  }, cookie);
  assertEquals(response.status, STATUS_CODE.OK);

  const updated = await response.json();
  assertEquals(updated.writingStyle, "Dritte Person, Vergangenheit.");

  // The point of the fields: somebody who has not written with you reads them.
  const readerCookie = await registerUser(reader);
  const profile = await (await request(
    "GET",
    `/api/users/${await getUserId(author)}`,
    readerCookie,
  )).json();

  assertEquals(profile.aboutMe, "Schreibe seit zehn Jahren, meist abends.");
  assertEquals(profile.writingBoundaries, "Nichts Explizites.");
});

Deno.test("PATCH /api/users/me leaves out what it was not sent", async () => {
  const cookie = await registerUser(author);

  await sendJson("PATCH", "/api/users/me", {
    writingStyle: "Erste Person.",
    postLength: "Zwei bis drei Absätze.",
  }, cookie);

  // The trap the story tags fell into: a default would materialise every omitted field, so a
  // partial update would silently empty the rest of the profile.
  const response = await sendJson("PATCH", "/api/users/me", {
    postLength: "Eine Seite.",
  }, cookie);

  const profile = await response.json();
  assertEquals(profile.postLength, "Eine Seite.");
  assertEquals(profile.writingStyle, "Erste Person.");
});

Deno.test("PATCH /api/users/me clears a field sent blank", async () => {
  const cookie = await registerUser(author);

  await sendJson(
    "PATCH",
    "/api/users/me",
    { writingBoundaries: "Nichts Explizites." },
    cookie,
  );
  const response = await sendJson(
    "PATCH",
    "/api/users/me",
    { writingBoundaries: "   " },
    cookie,
  );

  const profile = await response.json();
  assertEquals(
    profile.writingBoundaries,
    null,
    "whitespace is the absence of an answer, not an answer",
  );
});

Deno.test("PATCH /api/users/me refuses a field past its limit", async () => {
  const cookie = await registerUser(author);

  const response = await sendJson("PATCH", "/api/users/me", {
    writingStyle: "z".repeat(TEXT_LIMIT.profileDetail + 1),
  }, cookie);

  assertEquals(response.status, STATUS_CODE.BadRequest);
});

Deno.test("PATCH /api/users/me refuses a body that changes nothing", async () => {
  const cookie = await registerUser(author);

  const response = await sendJson("PATCH", "/api/users/me", {}, cookie);

  assertEquals(response.status, STATUS_CODE.BadRequest);
});

Deno.test("PATCH /api/users/me needs a session", async () => {
  const response = await sendJson("PATCH", "/api/users/me", {
    aboutMe: "Ohne Sitzung.",
  });

  assertEquals(response.status, STATUS_CODE.Unauthorized);
});
