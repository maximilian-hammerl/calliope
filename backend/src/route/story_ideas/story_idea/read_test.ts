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

const markRead = (cookie: string, ideaId: string) =>
  request("PUT", `/api/story-ideas/${ideaId}/read`, cookie, undefined);

const clearState = (cookie: string, ideaId: string) =>
  request("DELETE", `/api/story-ideas/${ideaId}/read`, cookie);

async function ideaFrom(cookie: string, title: string) {
  const response = await createIdea(cookie, { title });
  assertEquals(response.status, STATUS_CODE.Created);
  return await response.json();
}

Deno.test("PUT read marks an idea read, and the reader sees its own state", async () => {
  const authorCookie = await registerUser(author);
  const readerCookie = await registerUser(bystander);
  const idea = await ideaFrom(authorCookie, "Zu lesen");

  const before = await (await listIdeas(readerCookie, {})).json();
  assertEquals(
    before.results.find((i: { id: string }) => i.id === idea.id).isRead,
    false,
  );

  assertEquals(
    (await markRead(readerCookie, idea.id)).status,
    STATUS_CODE.OK,
  );

  const after = await (await listIdeas(readerCookie, {})).json();
  assertEquals(
    after.results.find((i: { id: string }) => i.id === idea.id).isRead,
    true,
  );
});

Deno.test("PUT read twice is not an error", async () => {
  const authorCookie = await registerUser(author);
  const readerCookie = await registerUser(bystander);
  const idea = await ideaFrom(authorCookie, "Zweimal");

  await markRead(readerCookie, idea.id);
  assertEquals(
    (await markRead(readerCookie, idea.id)).status,
    STATUS_CODE.OK,
  );

  const page = await (await listIdeas(readerCookie, {})).json();
  assertEquals(
    page.results.find((i: { id: string }) => i.id === idea.id).isRead,
    true,
  );
});

Deno.test("DELETE read puts the idea back to unread", async () => {
  const authorCookie = await registerUser(author);
  const readerCookie = await registerUser(bystander);
  const idea = await ideaFrom(authorCookie, "Wieder ungelesen");

  await markRead(readerCookie, idea.id);
  assertEquals(
    (await clearState(readerCookie, idea.id)).status,
    STATUS_CODE.OK,
  );

  const page = await (await listIdeas(readerCookie, {})).json();
  assertEquals(
    page.results.find((i: { id: string }) => i.id === idea.id).isRead,
    false,
  );

  // Answers the same way with nothing to remove: unread is the absence of a row.
  assertEquals(
    (await clearState(readerCookie, idea.id)).status,
    STATUS_CODE.OK,
  );
});

Deno.test("the board filters by whether the reader has read it", async () => {
  const authorCookie = await registerUser(author);
  const readerCookie = await registerUser(bystander);
  const first = await ideaFrom(authorCookie, "Gelesen eins");
  const second = await ideaFrom(authorCookie, "Gelesen zwei");
  const untouched = await ideaFrom(authorCookie, "Ungelesen");

  await markRead(readerCookie, first.id);
  await markRead(readerCookie, second.id);

  const titles = async (readerState: string) => {
    const page = await (await listIdeas(readerCookie, { readerState })).json();
    return page.results.map((i: { title: string }) => i.title);
  };

  const unreadTitles = await titles("unread");
  assertEquals(unreadTitles.includes("Ungelesen"), true);
  assertEquals(unreadTitles.includes("Gelesen eins"), false);
  assertEquals(unreadTitles.includes("Gelesen zwei"), false);

  // Both, and this is the half the old single column got wrong: while `marked` and `read` shared
  // one column, asking for `read` hid everything the member had marked.
  const readTitles = await titles("read");
  assertEquals(readTitles.includes("Gelesen eins"), true);
  assertEquals(readTitles.includes("Gelesen zwei"), true);

  // Nothing about the idea itself changed, so it is still there without a filter.
  const all = await titles("any");
  for (const title of ["Gelesen eins", "Gelesen zwei", "Ungelesen"]) {
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

  await markRead(readerCookie, idea.id);

  // The whole privacy rule of the feature: "four members read your idea" is exactly the
  // statistic the research rejected, so nobody else's state is readable anywhere.
  const forOther = await (await listIdeas(otherCookie, {})).json();
  assertEquals(
    forOther.results.find((i: { id: string }) => i.id === idea.id).isRead,
    false,
  );

  const forAuthor = await (await listIdeas(authorCookie, { author: "mine" }))
    .json();
  assertEquals(
    forAuthor.results.find((i: { id: string }) => i.id === idea.id).isRead,
    false,
  );
});

Deno.test("PUT read refuses the reader's own idea", async () => {
  const authorCookie = await registerUser(author);
  const idea = await ideaFrom(authorCookie, "Meine eigene");

  // Discovery never lists a member their own idea, so a state on it could never be shown.
  assertEquals(
    (await markRead(authorCookie, idea.id)).status,
    STATUS_CODE.Forbidden,
  );
});

Deno.test("a closed idea can still be marked read, and keeps it", async () => {
  const authorCookie = await registerUser(author);
  const readerCookie = await registerUser(bystander);
  const idea = await ideaFrom(authorCookie, "Bald geschlossen");

  await markRead(readerCookie, idea.id);
  await patchIdea(authorCookie, idea.id, { status: "closed" });

  // The mark belongs to the member, the status to the author: closing must not prune the pile.
  const page = await (await listIdeas(readerCookie, {
    readerState: "read",
    status: "any",
  })).json();
  const found = page.results.find((i: { id: string }) => i.id === idea.id);
  assertEquals(found.isRead, true);
  assertEquals(found.status, "closed");
});

Deno.test("PUT read answers 404 for an idea that does not exist", async () => {
  const readerCookie = await registerUser(bystander);

  const response = await markRead(
    readerCookie,
    "01a00000-0000-7000-8000-00000000ffff",
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});
