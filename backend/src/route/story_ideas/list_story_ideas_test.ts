import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
} from "@/src/test/support.ts";
import {
  author,
  bystander,
  createIdea,
  listIdeas,
  patchIdea,
} from "@/src/test/story_ideas.ts";

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([author, bystander]));

Deno.test("QUERY /api/story-ideas hides found and closed ideas by default", async () => {
  const cookie = await registerUser(author);

  const open = await (await createIdea(cookie, { title: "Offen" })).json();
  const closed = await (await createIdea(cookie, { title: "Zu" })).json();
  await patchIdea(cookie, closed.id, { status: "closed" });

  const page = await (await listIdeas(cookie, {})).json();
  const titles = page.results.map((idea: { title: string }) => idea.title);

  // §8.3's point: what is settled stops cluttering the board, but stays reachable by asking.
  assertEquals(titles.includes("Offen"), true);
  assertEquals(titles.includes("Zu"), false);
  assertEquals(open.status, "open");

  const closedPage = await (await listIdeas(cookie, { status: "closed" }))
    .json();
  const closedTitles = closedPage.results.map((idea: { title: string }) =>
    idea.title
  );
  assertEquals(closedTitles.includes("Zu"), true);
});

Deno.test("QUERY /api/story-ideas filters by language and searches the idea text", async () => {
  const cookie = await registerUser(author);

  await createIdea(cookie, { title: "Deutsch", idea: "Ein Turm aus Glas." });
  await createIdea(cookie, {
    title: "English",
    idea: "A lighthouse letters story.",
    language: "english",
  });

  const english = await (await listIdeas(cookie, { language: "english" }))
    .json();
  assertEquals(english.results.length, 1);
  assertEquals(english.results[0].title, "English");

  const search = await (await listIdeas(cookie, { search: "Turm aus Glas" }))
    .json();
  assertEquals(search.results.length, 1);
  assertEquals(search.results[0].title, "Deutsch");
});

Deno.test("QUERY /api/story-ideas with mine shows only one's own, closed included", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);

  const closed = await (await createIdea(cookie, { title: "Meine, zu" }))
    .json();
  await patchIdea(cookie, closed.id, { status: "closed" });
  await createIdea(other, { title: "Fremde" });

  const mine = await (await listIdeas(cookie, { mine: true })).json();
  const titles = mine.results.map((idea: { title: string }) => idea.title);

  // The author manages every idea they posted; hiding a closed one here would make closing
  // it irreversible in the interface.
  assertEquals(titles, ["Meine, zu"]);
});

Deno.test("QUERY /api/story-ideas needs a session", async () => {
  const response = await listIdeas("", {});
  assertEquals(response.status, STATUS_CODE.Unauthorized);
});
