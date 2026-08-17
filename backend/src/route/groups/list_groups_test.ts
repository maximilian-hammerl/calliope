import { assertEquals, assertFalse } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test_support.ts";

const owner = "list-groups-owner";
const outsider = "list-groups-outsider";

const FIRST_TITLE = "Aaa Schreibkreis";
const SECOND_TITLE = "Zzz Schreibkreis";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([owner, outsider]));

async function createGroup(
  cookie: string,
  title: string,
  visibility: "public" | "private",
) {
  const response = await request("POST", "/api/groups", cookie, {
    title,
    description: "d",
    visibility,
  });
  assertEquals(response.status, STATUS_CODE.Created);
  return await response.json();
}

type Page = { results: Array<{ title: string }>; totalResults: number };

async function list(cookie: string, body: unknown = {}): Promise<Page> {
  const response = await request("QUERY", "/api/groups", cookie, body);
  assertEquals(response.status, STATUS_CODE.OK);
  return await response.json();
}

/** The two titles this file created, in the order the endpoint returned them. */
function ownTitles(page: Page): Array<string> {
  return page.results
    .map((group) => group.title)
    .filter((title) => title === FIRST_TITLE || title === SECOND_TITLE);
}

// Totals count every group the user can see, so the assertions are relative to whatever
// the database already holds rather than to an absolute number.

Deno.test("QUERY /api/groups returns the user's own groups with a total", async () => {
  const cookie = await registerUser(owner);
  const before = await list(cookie);

  await createGroup(cookie, FIRST_TITLE, "private");
  await createGroup(cookie, SECOND_TITLE, "public");

  const page = await list(cookie, { limit: 10, offset: 0 });

  assertEquals(page.totalResults, before.totalResults + 2);
  // Newest first by default.
  assertEquals(page.results.slice(0, 2).map((group) => group.title), [
    SECOND_TITLE,
    FIRST_TITLE,
  ]);
});

Deno.test("QUERY /api/groups applies its defaults to an empty body", async () => {
  const cookie = await registerUser(owner);
  await createGroup(cookie, FIRST_TITLE, "private");

  // No paging or sorting given: the schema's defaults have to fill in.
  const page = await list(cookie, {});

  assertEquals(page.results.length <= 20, true);
  assertEquals(page.results[0].title, FIRST_TITLE);
});

Deno.test("QUERY /api/groups sorts by the requested attribute and order", async () => {
  const cookie = await registerUser(owner);
  await createGroup(cookie, SECOND_TITLE, "private");
  await createGroup(cookie, FIRST_TITLE, "private");

  const ascending = await list(cookie, {
    sortAttribute: "title",
    sortOrder: "asc",
    limit: 100,
  });
  assertEquals(ownTitles(ascending), [FIRST_TITLE, SECOND_TITLE]);

  const descending = await list(cookie, {
    sortAttribute: "title",
    sortOrder: "desc",
    limit: 100,
  });
  assertEquals(ownTitles(descending), [SECOND_TITLE, FIRST_TITLE]);
});

Deno.test("QUERY /api/groups rejects an attribute it cannot sort by", async () => {
  const cookie = await registerUser(owner);

  const response = await request("QUERY", "/api/groups", cookie, {
    sortAttribute: "hashedPassword",
  });

  // The enum is what keeps arbitrary column names away from `dynamic.ref`.
  assertEquals(response.status, STATUS_CODE.BadRequest);
  assertEquals(
    (await response.json()).issues.map((issue: { path: string }) => issue.path),
    ["sortAttribute"],
  );
});

Deno.test("QUERY /api/groups rejects a limit that is not a number", async () => {
  const cookie = await registerUser(owner);

  // A JSON body carries real types, so a numeric string is simply wrong here.
  const response = await request("QUERY", "/api/groups", cookie, {
    limit: "20",
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  assertEquals(
    (await response.json()).issues.map((issue: { path: string }) => issue.path),
    ["limit"],
  );
});

Deno.test("QUERY /api/groups hides another user's private group", async () => {
  const ownerCookie = await registerUser(owner);
  await createGroup(ownerCookie, FIRST_TITLE, "private");
  await createGroup(ownerCookie, SECOND_TITLE, "public");

  const outsiderCookie = await registerUser(outsider);
  const page = await list(outsiderCookie, { limit: 100 });
  const titles = page.results.map((group) => group.title);

  assertEquals(titles.includes(SECOND_TITLE), true);
  assertFalse(titles.includes(FIRST_TITLE));
});
