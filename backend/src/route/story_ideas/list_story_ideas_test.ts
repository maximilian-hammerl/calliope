import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";
import {
  createIdea,
  listIdeas,
  patchIdea,
  storyIdeaUsers,
} from "@/src/test/story_ideas.ts";

// Its own two accounts, so another file's cleanup cannot delete them.
const { author, bystander } = storyIdeaUsers("list");

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([author, bystander]));

Deno.test("QUERY /api/story-ideas hides closed ideas by default", async () => {
  const cookie = await registerUser(author);
  const reader = await registerUser(bystander);

  const open = await (await createIdea(cookie, { title: "Offen" })).json();
  const closed = await (await createIdea(cookie, { title: "Zu" })).json();
  await patchIdea(cookie, closed.id, { status: "closed" });

  const page = await (await listIdeas(reader, {})).json();
  const titles = page.results.map((idea: { title: string }) => idea.title);

  // §8.3's point: what is settled stops cluttering the board, but stays reachable by asking.
  assertEquals(titles.includes("Offen"), true);
  assertEquals(titles.includes("Zu"), false);
  assertEquals(open.status, "open");

  const closedPage = await (await listIdeas(reader, { status: "closed" }))
    .json();
  const closedTitles = closedPage.results.map((idea: { title: string }) =>
    idea.title
  );
  assertEquals(closedTitles.includes("Zu"), true);
});

Deno.test("QUERY /api/story-ideas never shows the reader their own ideas", async () => {
  const cookie = await registerUser(author);
  const reader = await registerUser(bystander);

  await createIdea(cookie, { title: "Fremde Idee" });
  await createIdea(reader, { title: "Eigene Idee" });

  const page = await (await listIdeas(reader, {})).json();
  const titles = page.results.map((idea: { title: string }) => idea.title);

  // The board is discovery: like a public group the reader is already in, their own idea is
  // not something to find. It lives on Meine Storyideen instead.
  assertEquals(titles.includes("Fremde Idee"), true);
  assertEquals(titles.includes("Eigene Idee"), false);
});

Deno.test("QUERY /api/story-ideas filters by language and searches the idea text", async () => {
  const cookie = await registerUser(author);
  const reader = await registerUser(bystander);

  await createIdea(cookie, {
    title: "Deutsch",
    synopsis: "Ein Turm aus Glas.",
  });
  await createIdea(cookie, {
    title: "English",
    synopsis: "A lighthouse letters story.",
    language: "english",
  });

  // Included and excluded, never counted: a count asserts on the whole board, which any
  // other idea — seeded, or from a test running beside this one — makes wrong.
  const english = await (await listIdeas(reader, { language: "english" }))
    .json();
  const englishTitles = english.results.map((idea: { title: string }) =>
    idea.title
  );
  assertEquals(englishTitles.includes("English"), true);
  assertEquals(englishTitles.includes("Deutsch"), false);

  const search = await (await listIdeas(reader, { search: "Turm aus Glas" }))
    .json();
  const searchTitles = search.results.map((idea: { title: string }) =>
    idea.title
  );
  assertEquals(searchTitles.includes("Deutsch"), true);
  assertEquals(searchTitles.includes("English"), false);
});

Deno.test("QUERY /api/story-ideas with author mine shows only one's own, closed included", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);

  const closed = await (await createIdea(cookie, { title: "Meine, zu" }))
    .json();
  await patchIdea(cookie, closed.id, { status: "closed" });
  await createIdea(other, { title: "Fremde" });

  const mine = await (await listIdeas(cookie, { author: "mine" })).json();
  const titles = mine.results.map((idea: { title: string }) => idea.title);

  // The author manages every idea they posted; hiding a closed one here would make closing
  // it irreversible in the interface.
  assertEquals(titles, ["Meine, zu"]);
});

Deno.test("QUERY /api/story-ideas needs a session", async () => {
  const response = await listIdeas("", {});
  assertEquals(response.status, STATUS_CODE.Unauthorized);
});

/**
 * The board narrows by the same vocabularies a group's does, through the same helper — so an
 * idea and the group it becomes cannot be findable by different things.
 */
Deno.test("QUERY /api/story-ideas narrows the board to the genres asked for", async () => {
  const cookie = await registerUser(author);
  const reader = await registerUser(bystander);

  const fantasy = await (await createIdea(cookie, {
    title: "Fantasy-Idee",
    genres: ["fantasy"],
    tropes: ["slow_burn"],
  })).json();
  const western = await (await createIdea(cookie, {
    title: "Western-Idee",
    genres: ["western"],
  })).json();

  const page = await (await listIdeas(reader, {
    genres: ["fantasy"],
    limit: 100,
  })).json();
  const ids = page.results.map((idea: { id: string }) => idea.id);

  assertEquals(ids.includes(fantasy.id), true);
  assertEquals(ids.includes(western.id), false);
});

Deno.test("QUERY /api/story-ideas widens within a field and narrows across two", async () => {
  const cookie = await registerUser(author);
  const reader = await registerUser(bystander);

  const fantasy = await (await createIdea(cookie, {
    title: "Fantasy, langsam",
    genres: ["fantasy"],
    tropes: ["slow_burn"],
  })).json();
  const western = await (await createIdea(cookie, {
    title: "Western, ohne Trope",
    genres: ["western"],
  })).json();

  const either = await (await listIdeas(reader, {
    genres: ["fantasy", "western"],
    limit: 100,
  })).json();
  const eitherIds = either.results.map((idea: { id: string }) => idea.id);
  assertEquals(eitherIds.includes(fantasy.id), true);
  assertEquals(eitherIds.includes(western.id), true);

  const both = await (await listIdeas(reader, {
    genres: ["fantasy", "western"],
    tropes: ["slow_burn"],
    limit: 100,
  })).json();
  const bothIds = both.results.map((idea: { id: string }) => idea.id);
  assertEquals(bothIds.includes(fantasy.id), true);
  assertEquals(bothIds.includes(western.id), false);
});

Deno.test("QUERY /api/story-ideas/carousel is not narrowed by a board filter", async () => {
  const cookie = await registerUser(author);
  const reader = await registerUser(bystander);
  const western = await (await createIdea(cookie, {
    title: "Western im Karussell",
    genres: ["western"],
  })).json();

  // The carousel shares the filter chain and passes no vocabulary, so its set stays the view's
  // own — a neighbour it offers must never be one the board would hide.
  const step =
    await (await request("QUERY", "/api/story-ideas/carousel", reader, {
      storyIdeaId: western.id,
    })).json();

  assertEquals(step.storyIdea.id, western.id);
});
