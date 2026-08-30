import { assertEquals, assertExists, assertFalse } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { db } from "@/src/database/client.ts";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";

const searcher = "list-users-searcher";
// The distinctive middle syllable is what the substring tests look for; no prefix of it
// would find these accounts.
const findable = "list-users-quenya-one";
const alsoFindable = "list-users-quenya-two";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([searcher, findable, alsoFindable]));

type Page = {
  results: Array<
    { id: string; username: string; platformRole: string | null }
  >;
  totalResults: number;
};

async function search(cookie: string, body: unknown) {
  return await request("QUERY", "/api/users", cookie, body);
}

async function searchOk(cookie: string, body: unknown): Promise<Page> {
  const response = await search(cookie, body);
  assertEquals(response.status, STATUS_CODE.OK);
  return await response.json();
}

Deno.test("QUERY /api/users matches a substring, not just a prefix", async () => {
  const cookie = await registerUser(searcher);
  await registerUser(findable);
  await registerUser(alsoFindable);

  const page = await searchOk(cookie, { search: "quenya" });

  assertEquals(page.totalResults, 2);
  assertEquals(
    page.results.map((user) => user.username).sort(),
    [
      findable,
      alsoFindable,
    ].sort(),
  );
});

Deno.test("QUERY /api/users ignores case", async () => {
  const cookie = await registerUser(searcher);
  await registerUser(findable);

  const page = await searchOk(cookie, { search: "QUENYA" });

  assertEquals(page.totalResults, 1);
  const [found] = page.results;
  assertExists(found);
  assertEquals(found.username, findable);
});

Deno.test("QUERY /api/users returns a name, a picture, a role and nothing else", async () => {
  const cookie = await registerUser(searcher);
  await registerUser(findable);

  const page = await searchOk(cookie, { search: "quenya" });

  // Spelled out rather than checked for absence, so a column added to the table later
  // fails this instead of quietly joining the response.
  const [found] = page.results;
  assertExists(found);
  assertEquals(Object.keys(found).sort(), [
    "avatarUrl",
    "id",
    "platformRole",
    "username",
  ]);
});

Deno.test("QUERY /api/users treats a wildcard as a literal character", async () => {
  const cookie = await registerUser(searcher);
  await registerUser(findable);

  // Unescaped, `%` and `_` would match anything and return the whole table.
  for (const term of ["%%%", "___"]) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    const page = await searchOk(cookie, { search: term });
    assertEquals(page.totalResults, 0, `${term} should match nothing`);
  }
});

Deno.test("QUERY /api/users rejects a term shorter than three characters", async () => {
  const cookie = await registerUser(searcher);

  const response = await search(cookie, { search: "qu" });

  assertEquals(response.status, STATUS_CODE.BadRequest);
});

Deno.test("QUERY /api/users lists members when no term is given", async () => {
  const cookie = await registerUser(searcher);
  await registerUser(findable);

  // Optional like on every other list endpoint, so the five behave alike.
  const page = await searchOk(cookie, {});

  assertEquals(
    page.results.some((user) => user.username === findable),
    true,
  );
});

Deno.test("QUERY /api/users needs a session", async () => {
  const response = await request("QUERY", "/api/users", "", {
    search: "quenya",
  });

  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertFalse(response.headers.has("set-cookie"));
});

/** #101: without a role in the list, "ich bin Moderator" is a claim nobody can check. */
Deno.test("QUERY /api/users carries the platform role, and null for an ordinary member", async () => {
  const cookie = await registerUser(searcher);
  await registerUser(findable);
  await db
    .updateTable("user")
    .set({ platformRole: "moderator" })
    .where("username", "=", findable)
    .execute();

  const page = await searchOk(cookie, { search: "quenya-one" });
  const found = page.results.find((user) => user.username === findable);

  assertExists(found);
  assertEquals(found.platformRole, "moderator");

  const ordinary = await searchOk(cookie, { search: "searcher" });
  assertEquals(
    ordinary.results.find((user) => user.username === searcher)?.platformRole,
    null,
  );
});
