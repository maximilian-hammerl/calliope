import { assert, assertEquals, assertFalse } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";
import { createIdea, patchIdea } from "@/src/test/story_ideas.ts";

const owner = "search-owner";
const outsider = "search-outsider";

const TERM = "nachtmarkt";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([owner, outsider]));

type Section = { results: Array<Record<string, string>>; totalResults: number };
type SearchResults = {
  groups: Section;
  threads: Section;
  pages: Section;
  storyIdeas: Section;
  users: Section;
};

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

/**
 * Assertions are relative to whatever the database already holds, so seed data or a leftover
 * row cannot decide whether these pass. The same reason `list_groups_test.ts` counts this way.
 */
function totals(found: SearchResults) {
  return {
    groups: found.groups.totalResults,
    threads: found.threads.totalResults,
    pages: found.pages.totalResults,
    storyIdeas: found.storyIdeas.totalResults,
    users: found.users.totalResults,
  };
}

const titles = (section: Section) =>
  section.results.map((result) => result.title);

Deno.test("QUERY /api/search finds each kind in one request", async () => {
  const cookie = await registerUser(owner);
  const before = totals(await search(cookie, { search: TERM }));

  const group = await createGroup(cookie, `${TERM} Gruppe`);
  await thread(cookie, group.id, `${TERM} Thread`);

  const found = await search(cookie, { search: TERM });

  assertEquals(found.groups.totalResults, before.groups + 1);
  assertEquals(found.threads.totalResults, before.threads + 1);
  assert(titles(found.groups).includes(`${TERM} Gruppe`));
  assert(titles(found.threads).includes(`${TERM} Thread`));
  // The searcher's own name does not contain the term, so no member matched it.
  assertEquals(found.users.totalResults, before.users);
});

Deno.test("QUERY /api/search says which group a thread came from", async () => {
  const cookie = await registerUser(owner);
  const group = await createGroup(cookie, `${TERM} Gruppe`);
  await thread(cookie, group.id, `${TERM} Thread`);

  const found = await search(cookie, { search: TERM });
  const foundThread = found.threads.results.find(
    (result) => result.title === `${TERM} Thread`,
  );

  // A result that can come from anywhere has to say where it came from.
  assertEquals(foundThread?.writingGroupTitle, `${TERM} Gruppe`);
});

Deno.test("QUERY /api/search hides threads in a private group you are not in", async () => {
  const ownerCookie = await registerUser(owner);
  const outsiderCookie = await registerUser(outsider);
  const before = totals(await search(outsiderCookie, { search: TERM }));

  const privateGroup = await createGroup(
    ownerCookie,
    `${TERM} Privat`,
    "private",
  );
  await thread(ownerCookie, privateGroup.id, `${TERM} Geheim`);

  // Nothing the outsider can see changed, because none of it is theirs to see.
  assertEquals(totals(await search(outsiderCookie, { search: TERM })), before);
});

Deno.test("QUERY /api/search finds threads in a public group you have not joined", async () => {
  const ownerCookie = await registerUser(owner);
  const outsiderCookie = await registerUser(outsider);
  const before = totals(await search(outsiderCookie, { search: TERM }));

  const publicGroup = await createGroup(ownerCookie, `${TERM} Offen`, "public");
  await thread(ownerCookie, publicGroup.id, `${TERM} Offener Thread`);

  const found = await search(outsiderCookie, { search: TERM });
  const foundThread = found.threads.results.find(
    (result) => result.title === `${TERM} Offener Thread`,
  );

  // The same rule the group list uses, applied one level down.
  assertEquals(found.threads.totalResults, before.threads + 1);
  assertEquals(foundThread?.writingGroupTitle, `${TERM} Offen`);
});

Deno.test("QUERY /api/search reports how many more there are", async () => {
  const cookie = await registerUser(owner);
  const before = totals(await search(cookie, { search: TERM }));

  for (let index = 0; index < 7; index++) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    await createGroup(cookie, `${TERM} Gruppe ${index}`);
  }

  const found = await search(cookie, { search: TERM, limit: 5 });

  // Five shown however many were found: the interface says „N weitere" from the difference.
  assertEquals(found.groups.results.length, 5);
  assertEquals(found.groups.totalResults, before.groups + 7);
});

Deno.test("QUERY /api/search finds story ideas, the reader's own included", async () => {
  const cookie = await registerUser(owner);
  const before = totals(await search(cookie, { search: TERM }));

  await createIdea(cookie, { title: `${TERM} Idee` });

  const found = await search(cookie, { search: TERM });

  // The board deliberately never shows an author their own ideas; searching for one you wrote
  // has to find it, or the field cannot answer "where is that idea I had".
  assertEquals(found.storyIdeas.totalResults, before.storyIdeas + 1);
  assert(titles(found.storyIdeas).includes(`${TERM} Idee`));
});

Deno.test("QUERY /api/search finds a closed story idea", async () => {
  const cookie = await registerUser(owner);
  const before = totals(await search(cookie, { search: TERM }));

  const idea = await (await createIdea(cookie, { title: `${TERM} Zu` })).json();
  await patchIdea(cookie, idea.id, { status: "closed" });

  const found = await search(cookie, { search: TERM });

  // Closed on the board means "stops cluttering it", not "cannot be found": the page is still
  // readable, and the interface labels the result.
  assertEquals(found.storyIdeas.totalResults, before.storyIdeas + 1);
  assert(titles(found.storyIdeas).includes(`${TERM} Zu`));
});

Deno.test("QUERY /api/search finds members by name", async () => {
  const cookie = await registerUser(owner);
  const before = totals(await search(cookie, { search: "search-outsi" }));

  await registerUser(outsider);

  const found = await search(cookie, { search: "search-outsi" });
  assertEquals(found.users.totalResults, before.users + 1);
  assert(found.users.results.some((result) => result.username === outsider));
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

async function page(
  cookie: string,
  groupId: string,
  title: string,
  text: string,
) {
  const response = await request(
    "POST",
    `/api/groups/${groupId}/pages`,
    cookie,
    {
      title,
      document: plainTextToDocument(text),
    },
  );
  assertEquals(response.status, STATUS_CODE.Created);
  return await response.json();
}

Deno.test("a page is found by its title and by its prose", async () => {
  const cookie = await registerUser(owner);
  const group = await createGroup(cookie, "Suchgruppe", "public");

  await page(cookie, group.id, `Der ${TERM}`, "Nichts besonderes hier.");
  await page(cookie, group.id, "Ein anderer Ort", `Dort liegt der ${TERM}.`);

  const found = await search(cookie, { search: TERM });

  // Both: a title match and a body match. The body is the whole point — a page is the one leaf
  // that can match on something its own row does not show.
  assertEquals(found.pages.totalResults, 2);
  assertEquals(titles(found.pages).includes(`Der ${TERM}`), true);
  assertEquals(titles(found.pages).includes("Ein anderer Ort"), true);
});

Deno.test("a page in a private group is not found by an outsider", async () => {
  const cookie = await registerUser(owner);
  const outsiderCookie = await registerUser(outsider);
  const group = await createGroup(cookie, "Geheim", "private");
  await page(cookie, group.id, `Der ${TERM}`, `Und der ${TERM} noch einmal.`);

  assertEquals(
    (await search(outsiderCookie, { search: TERM })).pages.totalResults,
    0,
  );
  assertEquals((await search(cookie, { search: TERM })).pages.totalResults, 1);
});
