import { assertEquals, assertExists, assertFalse } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";

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
    blurb: "d",
    visibility,
  });
  assertEquals(response.status, STATUS_CODE.Created);
  return await response.json();
}

type Page = {
  results: Array<{
    id: string;
    title: string;
    status: string | null;
    role: string | null;
  }>;
  totalResults: number;
};

/** The invitation tests need the id of the account being invited. */
async function currentUserId(cookie: string): Promise<string> {
  const response = await request("GET", "/api/auth/me", cookie);
  assertEquals(response.status, STATUS_CODE.OK);
  return (await response.json()).id;
}

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
  const [first] = page.results;
  assertExists(first);
  assertEquals(first.title, FIRST_TITLE);
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
  // "any" is the widest this endpoint goes: everything the caller may look at.
  const page = await list(outsiderCookie, { limit: 100, membership: "any" });
  const titles = page.results.map((group) => group.title);

  assertEquals(titles.includes(SECOND_TITLE), true);
  assertFalse(titles.includes(FIRST_TITLE));
});

Deno.test("QUERY /api/groups leaves out a public group the caller is not in", async () => {
  const ownerCookie = await registerUser(owner);
  await createGroup(ownerCookie, SECOND_TITLE, "public");

  const outsiderCookie = await registerUser(outsider);
  // The default is the caller's own groups. Being allowed to read a group is not belonging
  // to it, which is what the old default conflated.
  const page = await list(outsiderCookie, { limit: 100 });

  assertFalse(page.results.map((group) => group.title).includes(SECOND_TITLE));
});

Deno.test("QUERY /api/groups reports the caller's own standing in each group", async () => {
  const cookie = await registerUser(owner);
  await createGroup(cookie, FIRST_TITLE, "private");

  const [group] = (await list(cookie, { limit: 100 })).results;
  assertExists(group);

  // The founder joined their own group as its administrator.
  assertEquals(group.status, "joined");
  assertEquals(group.role, "administrator");
});

Deno.test("QUERY /api/groups separates an invitation from a membership", async () => {
  const ownerCookie = await registerUser(owner);
  const group = await createGroup(ownerCookie, FIRST_TITLE, "private");

  const outsiderCookie = await registerUser(outsider);
  const outsiderId = await currentUserId(outsiderCookie);

  const invited = await request(
    "POST",
    `/api/groups/${group.id}/memberships`,
    ownerCookie,
    { userId: outsiderId, role: "writer" },
  );
  assertEquals(invited.status, STATUS_CODE.Created);

  // An invitation is not a membership: it belongs in neither the rail nor "Meine Gruppen".
  assertFalse(ownTitles(await list(outsiderCookie, { limit: 100 })).length > 0);

  const pending = await list(outsiderCookie, {
    limit: 100,
    membership: "invited",
  });
  assertEquals(ownTitles(pending), [FIRST_TITLE]);
  // The role being offered is stated while the invitation is pending; the status is what
  // says it may not be acted on yet.
  const [invitation] = pending.results;
  assertExists(invitation);
  assertEquals(invitation.status, "invited");
  assertEquals(invitation.role, "writer");
});

Deno.test("QUERY /api/groups discovers public groups the caller is not in", async () => {
  const ownerCookie = await registerUser(owner);
  await createGroup(ownerCookie, FIRST_TITLE, "private");
  await createGroup(ownerCookie, SECOND_TITLE, "public");

  const outsiderCookie = await registerUser(outsider);
  const page = await list(outsiderCookie, { limit: 100, membership: "none" });

  // Only the public one, and with no standing of their own in it.
  assertEquals(ownTitles(page), [SECOND_TITLE]);
  const [stranger] = page.results;
  assertExists(stranger);
  assertEquals(stranger.status, null);
  assertEquals(stranger.role, null);

  // The founder is in it, so it is not theirs to discover.
  assertFalse(
    ownTitles(await list(ownerCookie, { limit: 100, membership: "none" }))
      .includes(SECOND_TITLE),
  );
});

Deno.test("QUERY /api/groups rejects a membership filter it does not know", async () => {
  const cookie = await registerUser(owner);

  const response = await request("QUERY", "/api/groups", cookie, {
    membership: "everything",
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  assertEquals(
    (await response.json()).issues.map((issue: { path: string }) => issue.path),
    ["membership"],
  );
});

Deno.test("QUERY /api/groups filters by a substring of the title", async () => {
  const cookie = await registerUser(owner);

  await createGroup(cookie, FIRST_TITLE, "private");
  await createGroup(cookie, SECOND_TITLE, "private");

  // "Aaa" and "Zzz" differ; the shared word does not.
  assertEquals(ownTitles(await list(cookie, { search: "Aaa" })), [FIRST_TITLE]);
  assertEquals(
    ownTitles(await list(cookie, { search: "Schreibkreis" })).length,
    2,
  );
});

Deno.test("QUERY /api/groups rejects a search term shorter than three characters", async () => {
  const cookie = await registerUser(owner);

  const response = await request("QUERY", "/api/groups", cookie, {
    search: "Aa",
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
});
