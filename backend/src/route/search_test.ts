import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";
import { createIdea, patchIdea } from "@/src/test/story_ideas.ts";
import {
  clearForum,
  createForumFolder,
  createForumPage,
  createForumThread,
} from "@/src/test/forum.ts";
import { makeOperator } from "@/src/test/reports.ts";

const owner = "search-owner";
const outsider = "search-outsider";

const TERM = "nachtmarkt";

beforeEach(clearRateLimits);
afterEach(async () => {
  await clearForum([owner, outsider]);
  await deleteUsers([owner, outsider]);
});

type Section = { results: Array<Record<string, string>>; totalResults: number };
type SearchResults = {
  groups: Section;
  threads: Section;
  pages: Section;
  forumThreads: Section;
  forumPages: Section;
  storyIdeas: Section;
  users: Section;
};

async function search(cookie: string, body: unknown): Promise<SearchResults> {
  const response = await request("QUERY", "/api/search", cookie, body);
  assert.equal(response.status, STATUS_CODE.OK);
  return await response.json();
}

async function thread(cookie: string, groupId: string, title: string) {
  const response = await request(
    "POST",
    `/api/groups/${groupId}/threads`,
    cookie,
    { title },
  );
  assert.equal(response.status, STATUS_CODE.Created);
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

test("QUERY /api/search finds each kind in one request", async () => {
  const cookie = await registerUser(owner);
  const before = totals(await search(cookie, { search: TERM }));

  const group = await createGroup(cookie, `${TERM} Gruppe`);
  await thread(cookie, group.id, `${TERM} Thread`);

  const found = await search(cookie, { search: TERM });

  assert.equal(found.groups.totalResults, before.groups + 1);
  assert.equal(found.threads.totalResults, before.threads + 1);
  assert(titles(found.groups).includes(`${TERM} Gruppe`));
  assert(titles(found.threads).includes(`${TERM} Thread`));
  // The searcher's own name does not contain the term, so no member matched it.
  assert.equal(found.users.totalResults, before.users);
});

test("QUERY /api/search says which group a thread came from", async () => {
  const cookie = await registerUser(owner);
  const group = await createGroup(cookie, `${TERM} Gruppe`);
  await thread(cookie, group.id, `${TERM} Thread`);

  const found = await search(cookie, { search: TERM });
  const foundThread = found.threads.results.find(
    (result) => result.title === `${TERM} Thread`,
  );

  // A result that can come from anywhere has to say where it came from.
  assert.equal(foundThread?.writingGroupTitle, `${TERM} Gruppe`);
});

test("QUERY /api/search hides threads in a private group you are not in", async () => {
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
  assert.deepEqual(
    totals(await search(outsiderCookie, { search: TERM })),
    before,
  );
});

test("QUERY /api/search finds threads in a public group you have not joined", async () => {
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
  assert.equal(found.threads.totalResults, before.threads + 1);
  assert.equal(foundThread?.writingGroupTitle, `${TERM} Offen`);
});

test("QUERY /api/search reports how many more there are", async () => {
  const cookie = await registerUser(owner);
  const before = totals(await search(cookie, { search: TERM }));

  for (let index = 0; index < 7; index++) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    await createGroup(cookie, `${TERM} Gruppe ${index}`);
  }

  const found = await search(cookie, { search: TERM, limit: 5 });

  // Five shown however many were found: the interface says „N weitere" from the difference.
  assert.equal(found.groups.results.length, 5);
  assert.equal(found.groups.totalResults, before.groups + 7);
});

test("QUERY /api/search finds story ideas, the reader's own included", async () => {
  const cookie = await registerUser(owner);
  const before = totals(await search(cookie, { search: TERM }));

  await createIdea(cookie, { title: `${TERM} Idee` });

  const found = await search(cookie, { search: TERM });

  // The board deliberately never shows an author their own ideas; searching for one you wrote
  // has to find it, or the field cannot answer "where is that idea I had".
  assert.equal(found.storyIdeas.totalResults, before.storyIdeas + 1);
  assert(titles(found.storyIdeas).includes(`${TERM} Idee`));
});

test("QUERY /api/search finds a closed story idea", async () => {
  const cookie = await registerUser(owner);
  const before = totals(await search(cookie, { search: TERM }));

  const idea = await (await createIdea(cookie, { title: `${TERM} Zu` })).json();
  await patchIdea(cookie, idea.id, { status: "closed" });

  const found = await search(cookie, { search: TERM });

  // Closed on the board means "stops cluttering it", not "cannot be found": the page is still
  // readable, and the interface labels the result.
  assert.equal(found.storyIdeas.totalResults, before.storyIdeas + 1);
  assert(titles(found.storyIdeas).includes(`${TERM} Zu`));
});

test("QUERY /api/search finds members by name", async () => {
  const cookie = await registerUser(owner);
  const before = totals(await search(cookie, { search: "search-outsi" }));

  await registerUser(outsider);

  const found = await search(cookie, { search: "search-outsi" });
  assert.equal(found.users.totalResults, before.users + 1);
  assert(found.users.results.some((result) => result.username === outsider));
});

test("QUERY /api/search refuses a term shorter than three characters", async () => {
  const cookie = await registerUser(owner);

  const response = await request("QUERY", "/api/search", cookie, {
    search: "na",
  });

  assert.equal(response.status, STATUS_CODE.BadRequest);
});

test("QUERY /api/search needs a session", async () => {
  const response = await request("QUERY", "/api/search", "", { search: TERM });

  assert.equal(response.status, STATUS_CODE.Unauthorized);
  assert.ok(!response.headers.has("set-cookie"));
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
  assert.equal(response.status, STATUS_CODE.Created);
  return await response.json();
}

test("a page is found by its title and by its prose", async () => {
  const cookie = await registerUser(owner);
  const group = await createGroup(cookie, "Suchgruppe", "public");

  await page(cookie, group.id, `Der ${TERM}`, "Nichts besonderes hier.");
  await page(cookie, group.id, "Ein anderer Ort", `Dort liegt der ${TERM}.`);

  const found = await search(cookie, { search: TERM });

  // Both: a title match and a body match. The body is the whole point — a page is the one leaf
  // that can match on something its own row does not show.
  assert.equal(found.pages.totalResults, 2);
  assert.equal(titles(found.pages).includes(`Der ${TERM}`), true);
  assert.equal(titles(found.pages).includes("Ein anderer Ort"), true);
});

test("a page in a private group is not found by an outsider", async () => {
  const cookie = await registerUser(owner);
  const outsiderCookie = await registerUser(outsider);
  const group = await createGroup(cookie, "Geheim", "private");
  await page(cookie, group.id, `Der ${TERM}`, `Und der ${TERM} noch einmal.`);

  assert.equal(
    (await search(outsiderCookie, { search: TERM })).pages.totalResults,
    0,
  );
  assert.equal((await search(cookie, { search: TERM })).pages.totalResults, 1);
});

/**
 * The forum's matches are their own sections rather than rows in the group's. Merged, the five
 * slots would be shared, and a busy forum could take all of them — which is what these two assert
 * cannot happen: the same term matches in both scopes, and each section answers with its own.
 */
test("QUERY /api/search keeps the forum's threads and pages in their own sections", async () => {
  const cookie = await registerUser(owner);
  const group = await createGroup(cookie, `Gruppe ${TERM}`);
  await thread(cookie, group.id, `Thema ${TERM}`);

  const folder = await createForumFolder("Forenspiele", "write");
  await createForumThread(`Forumsthema ${TERM}`, "write", folder.id);
  await createForumPage(
    `Forumsseite ${TERM}`,
    "Nichts weiter.",
    "write",
    folder.id,
  );

  const found = await search(cookie, { search: TERM });

  assert.deepEqual(titles(found.threads), [`Thema ${TERM}`]);
  assert.deepEqual(titles(found.forumThreads), [`Forumsthema ${TERM}`]);
  assert.deepEqual(titles(found.forumPages), [`Forumsseite ${TERM}`]);

  // Its own total, which is what „und N weitere" reads: three left joins per query, and a count
  // that multiplied over any of them would report more than the section holds.
  assert.equal(found.forumThreads.totalResults, 1);
  assert.equal(found.forumPages.totalResults, 1);
  // The group's sections carry the group's rows and nothing else, which is the whole point of
  // keeping them apart.
  assert.deepEqual(titles(found.pages), []);
});

test("QUERY /api/search matches a forum page's prose, not only its title", async () => {
  const cookie = await registerUser(owner);
  const folder = await createForumFolder("Ankündigungen", "read");
  await createForumPage(
    "Regeln",
    `Wir treffen uns am ${TERM}.`,
    "read",
    folder.id,
  );

  const found = await search(cookie, { search: TERM });

  assert.deepEqual(titles(found.forumPages), ["Regeln"]);
});

test("QUERY /api/search hides what the forum hides, and shows an operator more", async () => {
  const memberCookie = await registerUser(owner);
  const operatorCookie = await makeOperator(
    outsider,
    await registerUser(outsider),
  );

  const hidden = await createForumFolder("Werkstatt", "hidden");
  await createForumThread(`Entwurf ${TERM}`, "write", hidden.id);

  // The same filter the tree applies, inherited rather than restated - so search cannot come to
  // disagree with it about what a member may see.
  assert.deepEqual(
    titles(
      await search(memberCookie, { search: TERM }).then((f) => f.forumThreads),
    ),
    [],
  );

  // An operator sees it here for the same reason they see it in the tree (#21).
  assert.deepEqual(
    titles(
      await search(operatorCookie, { search: TERM }).then((f) =>
        f.forumThreads
      ),
    ),
    [`Entwurf ${TERM}`],
  );
});
