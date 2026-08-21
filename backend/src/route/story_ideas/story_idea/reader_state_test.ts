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
const { author, bystander } = storyIdeaUsers("reader");
const third = "story-idea-reader-third";

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([author, bystander, third]));

const setState = (cookie: string, ideaId: string, state: string) =>
  request("PUT", `/api/story-ideas/${ideaId}/reader-state`, cookie, { state });

const clearState = (cookie: string, ideaId: string) =>
  request("DELETE", `/api/story-ideas/${ideaId}/reader-state`, cookie);

async function ideaFrom(cookie: string, title: string) {
  const response = await createIdea(cookie, { title });
  assertEquals(response.status, STATUS_CODE.Created);
  return await response.json();
}

Deno.test("PUT reader-state marks an idea read, and the reader sees its own state", async () => {
  const authorCookie = await registerUser(author);
  const readerCookie = await registerUser(bystander);
  const idea = await ideaFrom(authorCookie, "Zu lesen");

  const before = await (await listIdeas(readerCookie, {})).json();
  assertEquals(
    before.results.find((i: { id: string }) => i.id === idea.id).readerState,
    null,
  );

  assertEquals(
    (await setState(readerCookie, idea.id, "read")).status,
    STATUS_CODE.OK,
  );

  const after = await (await listIdeas(readerCookie, {})).json();
  assertEquals(
    after.results.find((i: { id: string }) => i.id === idea.id).readerState,
    "read",
  );
});

Deno.test("PUT reader-state overwrites, so marking twice is not an error", async () => {
  const authorCookie = await registerUser(author);
  const readerCookie = await registerUser(bystander);
  const idea = await ideaFrom(authorCookie, "Zweimal");

  await setState(readerCookie, idea.id, "read");
  assertEquals(
    (await setState(readerCookie, idea.id, "marked")).status,
    STATUS_CODE.OK,
  );

  const page = await (await listIdeas(readerCookie, {})).json();
  assertEquals(
    page.results.find((i: { id: string }) => i.id === idea.id).readerState,
    "marked",
  );
});

Deno.test("DELETE reader-state puts the idea back to unread", async () => {
  const authorCookie = await registerUser(author);
  const readerCookie = await registerUser(bystander);
  const idea = await ideaFrom(authorCookie, "Wieder ungelesen");

  await setState(readerCookie, idea.id, "marked");
  assertEquals(
    (await clearState(readerCookie, idea.id)).status,
    STATUS_CODE.OK,
  );

  const page = await (await listIdeas(readerCookie, {})).json();
  assertEquals(
    page.results.find((i: { id: string }) => i.id === idea.id).readerState,
    null,
  );

  // Answers the same way with nothing to remove: unread is the absence of a row.
  assertEquals(
    (await clearState(readerCookie, idea.id)).status,
    STATUS_CODE.OK,
  );
});

Deno.test("the board filters by the reader's own state", async () => {
  const authorCookie = await registerUser(author);
  const readerCookie = await registerUser(bystander);
  const read = await ideaFrom(authorCookie, "Gelesen");
  const marked = await ideaFrom(authorCookie, "Gemerkt");
  const untouched = await ideaFrom(authorCookie, "Ungelesen");

  await setState(readerCookie, read.id, "read");
  await setState(readerCookie, marked.id, "marked");

  const titles = async (readerState: string) => {
    const page = await (await listIdeas(readerCookie, { readerState })).json();
    return page.results.map((i: { title: string }) => i.title);
  };

  const unreadTitles = await titles("unread");
  assertEquals(unreadTitles.includes("Ungelesen"), true);
  assertEquals(unreadTitles.includes("Gelesen"), false);
  assertEquals(unreadTitles.includes("Gemerkt"), false);

  assertEquals((await titles("read")).includes("Gelesen"), true);
  assertEquals((await titles("read")).includes("Gemerkt"), false);
  assertEquals((await titles("marked")).includes("Gemerkt"), true);

  // Nothing about the idea itself changed, so it is still there without a filter.
  const all = await titles("any");
  for (const title of ["Gelesen", "Gemerkt", "Ungelesen"]) {
    assertEquals(
      all.includes(title),
      true,
      `${title} missing from the unfiltered board`,
    );
  }
  assertEquals(untouched.status, "open");
});

Deno.test("one member's state is never visible to another, nor to the author", async () => {
  const authorCookie = await registerUser(author);
  const readerCookie = await registerUser(bystander);
  const otherCookie = await registerUser(third);
  const idea = await ideaFrom(authorCookie, "Nur meine Sache");

  await setState(readerCookie, idea.id, "marked");

  // The whole privacy rule of the feature: "four members read your idea" is exactly the
  // statistic the research rejected, so nobody else's state is readable anywhere.
  const forOther = await (await listIdeas(otherCookie, {})).json();
  assertEquals(
    forOther.results.find((i: { id: string }) => i.id === idea.id).readerState,
    null,
  );

  const forAuthor = await (await listIdeas(authorCookie, { author: "mine" }))
    .json();
  assertEquals(
    forAuthor.results.find((i: { id: string }) => i.id === idea.id).readerState,
    null,
  );
});

Deno.test("PUT reader-state refuses the reader's own idea", async () => {
  const authorCookie = await registerUser(author);
  const idea = await ideaFrom(authorCookie, "Meine eigene");

  // Discovery never lists a member their own idea, so a state on it could never be shown.
  assertEquals(
    (await setState(authorCookie, idea.id, "read")).status,
    STATUS_CODE.Forbidden,
  );
});

Deno.test("a closed idea can still be marked, and keeps the mark", async () => {
  const authorCookie = await registerUser(author);
  const readerCookie = await registerUser(bystander);
  const idea = await ideaFrom(authorCookie, "Bald geschlossen");

  await setState(readerCookie, idea.id, "marked");
  await patchIdea(authorCookie, idea.id, { status: "closed" });

  // The mark belongs to the member, the status to the author: closing must not prune the pile.
  const page = await (await listIdeas(readerCookie, {
    readerState: "marked",
    status: "any",
  })).json();
  const found = page.results.find((i: { id: string }) => i.id === idea.id);
  assertEquals(found.readerState, "marked");
  assertEquals(found.status, "closed");
});

Deno.test("PUT reader-state answers 404 for an idea that does not exist", async () => {
  const readerCookie = await registerUser(bystander);

  const response = await setState(
    readerCookie,
    "01a00000-0000-7000-8000-00000000ffff",
    "read",
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});
