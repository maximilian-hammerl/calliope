import { assertEquals, assertExists } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  getUserId,
  registerUser,
  request,
  write,
} from "@/src/test/support.ts";
import { sendJson } from "@/src/test/auth.ts";

const viewer = "get-user-test-viewer";
const subject = "get-user-test-subject";

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([viewer, subject]));

Deno.test("GET /api/users/{userId} returns the profile", async () => {
  const cookie = await registerUser(viewer);
  await registerUser(subject);
  const subjectId = await getUserId(subject);

  const response = await request("GET", `/api/users/${subjectId}`, cookie);
  assertEquals(response.status, STATUS_CODE.OK);

  const profile = await response.json();
  assertEquals(profile.id, subjectId);
  assertEquals(profile.username, subject);
  assertExists(
    profile.createdAt,
    "the joined date is the one thing the list does not carry",
  );
});

Deno.test("GET /api/users/{userId} never returns an email address", async () => {
  const cookie = await registerUser(viewer);
  await registerUser(subject);

  const response = await request(
    "GET",
    `/api/users/${await getUserId(subject)}`,
    cookie,
  );

  const body = await response.text();
  assertEquals(body.includes("@"), false, body);
  assertEquals(body.includes("hashedPassword"), false, body);
});

Deno.test("GET /api/users/{userId} answers 404 for an id nobody has", async () => {
  const cookie = await registerUser(viewer);

  const response = await request(
    "GET",
    "/api/users/01a00000-0000-7000-8000-00000000ffff",
    cookie,
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});

Deno.test("GET /api/users/{userId} needs a session", async () => {
  await registerUser(subject);

  // `sendJson` rather than `request`, which requires a cookie by signature.
  const response = await sendJson(
    "GET",
    `/api/users/${await getUserId(subject)}`,
  );

  assertEquals(response.status, STATUS_CODE.Unauthorized);
});

/** #101: the profile is where somebody is looked up, so it is where the role has to be readable. */
Deno.test("GET /api/users/{userId} carries the platform role, and null for an ordinary member", async () => {
  const cookie = await registerUser(viewer);
  await registerUser(subject);
  const subjectId = await getUserId(subject);

  const ordinary =
    await (await request("GET", `/api/users/${subjectId}`, cookie)).json();
  assertEquals(ordinary.platformRole, null);

  await write((transaction) =>
    transaction
      .updateTable("user")
      .set({ platformRole: "administrator" })
      .where("id", "=", subjectId)
      .execute()
  );

  const promoted =
    await (await request("GET", `/api/users/${subjectId}`, cookie)).json();
  assertEquals(promoted.platformRole, "administrator");
});
