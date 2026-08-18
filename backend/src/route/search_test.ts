import { assertEquals, assertFalse } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test_support.ts";

const owner = "search-owner";
const outsider = "search-outsider";

// A word nothing else in the database is called, so the counts are absolute.
const TERM = "nachtmarkt";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([owner, outsider]));

type Section = { results: Array<Record<string, string>>; totalResults: number };
type SearchResults = { groups: Section; threads: Section; users: Section };

async function search(cookie: string, body: unknown): Promise<SearchResults> {
  const response = await request("QUERY", "/api/search", cookie, body);
  assertEquals(response.status, STATUS_CODE.OK);
  return await response.json();
}

async function thread(cookie: string, groupId: string, title: string) {
  const response = await request(
    "POST",
    `/api/groups/${groupId}/threads`,
    cookie,
    { title },
  );
  assertEquals(response.status, STATUS_CODE.Created);
  return await response.json();
}

Deno.test("QUERY /api/search finds each kind in one request", async () => {
  const cookie = await registerUser(owner);
  const group = await createGroup(cookie, `${TERM} Gruppe`);
  await thread(cookie, group.id, `${TERM} Thread`);

  const found = await search(cookie, { search: TERM });

  assertEquals(found.groups.results[0].title, `${TERM} Gruppe`);
  assertEquals(found.threads.results[0].title, `${TERM} Thread`);
  // The searcher's own name does not contain the term, so this section is empty.
  assertEquals(found.users.totalResults, 0);
});

Deno.test("QUERY /api/search says which group a thread came from", async () => {
  const cookie = await registerUser(owner);
  const group = await createGroup(cookie, `${TERM} Gruppe`);
  await thread(cookie, group.id, `${TERM} Thread`);

  const found = await search(cookie, { search: TERM });

  // A result that can come from anywhere has to say where it came from.
  assertEquals(found.threads.results[0].writingGroupTitle, `${TERM} Gruppe`);
});

Deno.test("QUERY /api/search hides threads in a private group you are not in", async () => {
  const ownerCookie = await registerUser(owner);
  const privateGroup = await createGroup(
    ownerCookie,
    `${TERM} Privat`,
    "private",
  );
  await thread(ownerCookie, privateGroup.id, `${TERM} Geheim`);

  const outsiderCookie = await registerUser(outsider);
  const found = await search(outsiderCookie, { search: TERM });

  assertEquals(found.threads.totalResults, 0);
  assertEquals(found.groups.totalResults, 0);
});

Deno.test("QUERY /api/search finds threads in a public group you have not joined", async () => {
  const ownerCookie = await registerUser(owner);
  const publicGroup = await createGroup(ownerCookie, `${TERM} Offen`, "public");
  await thread(ownerCookie, publicGroup.id, `${TERM} Offener Thread`);

  const outsiderCookie = await registerUser(outsider);
  const found = await search(outsiderCookie, { search: TERM });

  // The same rule the group list uses, applied one level down.
  assertEquals(found.threads.totalResults, 1);
  assertEquals(found.threads.results[0].writingGroupTitle, `${TERM} Offen`);
});

Deno.test("QUERY /api/search reports how many more there are", async () => {
  const cookie = await registerUser(owner);
  for (let index = 0; index < 7; index++) {
    await createGroup(cookie, `${TERM} Gruppe ${index}`);
  }

  const found = await search(cookie, { search: TERM, limit: 5 });

  // Five shown, seven found: the interface says „2 weitere" from these two numbers.
  assertEquals(found.groups.results.length, 5);
  assertEquals(found.groups.totalResults, 7);
});

Deno.test("QUERY /api/search finds members by name", async () => {
  const cookie = await registerUser(owner);

  const found = await search(cookie, { search: "search-outsi" });

  assertEquals(found.users.totalResults, 0, "nobody by that name yet");

  await registerUser(outsider);
  const afterwards = await search(cookie, { search: "search-outsi" });
  assertEquals(afterwards.users.results[0].username, outsider);
});

Deno.test("QUERY /api/search refuses a term shorter than three characters", async () => {
  const cookie = await registerUser(owner);

  const response = await request("QUERY", "/api/search", cookie, {
    search: "na",
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
});

Deno.test("QUERY /api/search needs a session", async () => {
  const response = await request("QUERY", "/api/search", "", { search: TERM });

  assertEquals(response.status, STATUS_CODE.Unauthorized);
  assertFalse(response.headers.has("set-cookie"));
});
