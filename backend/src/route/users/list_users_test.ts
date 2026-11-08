import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import { clearRateLimits, deleteUsers, registerUser, request, write } from "@/src/test/support.ts";

const searcher = "list-users-searcher";
// The distinctive middle syllable is what the substring tests look for; no prefix of it
// would find these accounts.
const findable = "list-users-quenya-one";
const alsoFindable = "list-users-quenya-two";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([searcher, findable, alsoFindable]));

type Page = {
  results: Array<{ id: string; username: string; platformRole: string | null }>;
  totalResults: number;
};

async function search(cookie: string, body: unknown) {
  return await request("QUERY", "/api/users", cookie, body);
}

async function searchOk(cookie: string, body: unknown): Promise<Page> {
  const response = await search(cookie, body);
  assert.equal(response.status, STATUS_CODE.OK);
  return await response.json();
}

test("QUERY /api/users matches a substring, not just a prefix", async () => {
  const cookie = await registerUser(searcher);
  await registerUser(findable);
  await registerUser(alsoFindable);

  const page = await searchOk(cookie, { search: "quenya" });

  assert.equal(page.totalResults, 2);
  assert.deepEqual(
    page.results.map((user) => user.username).sort(),
    [findable, alsoFindable].sort(),
  );
});

test("QUERY /api/users ignores case", async () => {
  const cookie = await registerUser(searcher);
  await registerUser(findable);

  const page = await searchOk(cookie, { search: "QUENYA" });

  assert.equal(page.totalResults, 1);
  const [found] = page.results;
  assert.ok(found);
  assert.equal(found.username, findable);
});

test("QUERY /api/users returns a name, a picture, a role and nothing else", async () => {
  const cookie = await registerUser(searcher);
  await registerUser(findable);

  const page = await searchOk(cookie, { search: "quenya" });

  // Spelled out rather than checked for absence, so a column added to the table later
  // fails this instead of quietly joining the response.
  const [found] = page.results;
  assert.ok(found);
  assert.deepEqual(Object.keys(found).sort(), ["avatarUrl", "id", "platformRole", "username"]);
});

test("QUERY /api/users treats a wildcard as a literal character", async () => {
  const cookie = await registerUser(searcher);
  await registerUser(findable);

  // Unescaped, `%` and `_` would match anything and return the whole table.
  for (const term of ["%%%", "___"]) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    const page = await searchOk(cookie, { search: term });
    assert.equal(page.totalResults, 0, `${term} should match nothing`);
  }
});

test("QUERY /api/users rejects a term shorter than three characters", async () => {
  const cookie = await registerUser(searcher);

  const response = await search(cookie, { search: "qu" });

  assert.equal(response.status, STATUS_CODE.BadRequest);
});

test("QUERY /api/users lists members when no term is given", async () => {
  const cookie = await registerUser(searcher);
  await registerUser(findable);

  // Optional like on every other list endpoint, so the five behave alike.
  const page = await searchOk(cookie, {});

  assert.equal(
    page.results.some((user) => user.username === findable),
    true,
  );
});

test("QUERY /api/users needs a session", async () => {
  const response = await request("QUERY", "/api/users", "", {
    search: "quenya",
  });

  assert.equal(response.status, STATUS_CODE.Unauthorized);
  assert.ok(!response.headers.has("set-cookie"));
});

/** #101: without a role in the list, "ich bin Moderator" is a claim nobody can check. */
test("QUERY /api/users carries the platform role, and null for an ordinary member", async () => {
  const cookie = await registerUser(searcher);
  await registerUser(findable);
  await write((transaction) =>
    transaction
      .updateTable("user")
      .set({ platformRole: "moderator" })
      .where("username", "=", findable)
      .execute(),
  );

  const page = await searchOk(cookie, { search: "quenya-one" });
  const found = page.results.find((user) => user.username === findable);

  assert.ok(found);
  assert.equal(found.platformRole, "moderator");

  const ordinary = await searchOk(cookie, { search: "searcher" });
  assert.equal(ordinary.results.find((user) => user.username === searcher)?.platformRole, null);
});
