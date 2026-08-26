import {
  assertEquals,
  assertGreaterOrEqual,
  assertLessOrEqual,
} from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";
import {
  createIdea,
  patchIdea,
  storyIdeaUsers,
} from "@/src/test/story_ideas.ts";

const { author, bystander } = storyIdeaUsers("carousel");

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([author, bystander]));

const carousel = (cookie: string, storyIdeaId?: string) =>
  request(
    "QUERY",
    "/api/story-ideas/carousel",
    cookie,
    storyIdeaId === undefined ? {} : { storyIdeaId },
  );

/**
 * Five ideas by one author, oldest first, so their ids ascend. The set also holds the seed's
 * and every other test file's ideas, so nothing here may assert an exact neighbour — only that
 * a neighbour lies between the anchor and the idea we know sits on that side.
 *
 * The outermost two are what make those bounds bite: with nothing beyond `newer`, a
 * *furthest*-neighbour bug returns `newer` itself and the assertion passes either way. Both
 * orderings were reversed on purpose to check that.
 */
async function walkableIdeas(cookie: string) {
  const ideas = [];
  const titles = [
    "Die erste",
    "Die zweite",
    "Die dritte",
    "Die vierte",
    "Die fünfte",
  ];

  for (const title of titles) {
    // Sequential, because the ids have to ascend in exactly this order.
    // deno-lint-ignore no-await-in-loop
    ideas.push(await (await createIdea(cookie, { title })).json());
  }

  const [oldest, older, middle, newer, newest] = ideas;
  return { oldest, older, middle, newer, newest };
}

Deno.test("QUERY /api/story-ideas/carousel opens at the newest idea of the set", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const { newest } = await walkableIdeas(cookie);

  const response = await carousel(other);
  assertEquals(response.status, STATUS_CODE.OK);

  const step = await response.json();
  assertEquals(step.storyIdea === null, false);
  // Five of them are ours, and every one is in this reader's set.
  assertGreaterOrEqual(step.total, 5);
  // Bounded, not exact, for the reason the fixture gives: the set holds every other file's
  // ideas too, so the newest of it cannot be older than the newest of ours.
  assertGreaterOrEqual(step.storyIdea.id, newest.id);
  // Unanchored, so the walk opened at the newest and nothing precedes it — by construction
  // rather than by a second query, which is what stopped this being flaky.
  assertEquals(step.previous, null);
  // Five ideas exist, so something follows whatever the newest one is.
  assertEquals(step.next === null, false);
});

Deno.test("QUERY /api/story-ideas/carousel answers with the ideas either side of the anchor", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const { older, middle, newer } = await walkableIdeas(cookie);

  const step = await (await carousel(other, middle.id)).json();

  assertEquals(step.storyIdea.id, middle.id);
  // Ids are uuidv7, so they sort as they were created: the previous idea is the nearest one
  // above this anchor, which cannot be further away than the idea we know sits above it.
  assertLessOrEqual(step.previous.id, newer.id);
  assertGreaterOrEqual(step.previous.id, middle.id);
  assertGreaterOrEqual(step.next.id, older.id);
  assertLessOrEqual(step.next.id, middle.id);
});

Deno.test("QUERY /api/story-ideas/carousel carries whole ideas, not ids", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const { middle } = await walkableIdeas(cookie);

  const step = await (await carousel(other, middle.id)).json();

  // The movement has to have something to move to, so a neighbour is everything the detail
  // view renders — the author's name included, which is joined rather than stored.
  // The anchor is ours; the neighbour may be anybody's, because another file running beside
  // this one can insert an idea between two of ours. Only the shape is asserted of it.
  assertEquals(step.storyIdea.createdByUsername, author);
  assertEquals(typeof step.next.teaser, "string");
  assertEquals(typeof step.next.synopsis, "string");
  assertEquals(typeof step.next.createdByUsername, "string");
  assertEquals(step.next.isRead, false);
});

Deno.test("QUERY /api/story-ideas/carousel keeps an anchor the member has read", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const { middle } = await walkableIdeas(cookie);

  const marking = await request(
    "PUT",
    `/api/story-ideas/${middle.id}/read`,
    other,
    { state: "read" },
  );
  assertEquals(marking.status, STATUS_CODE.OK);

  const step = await (await carousel(other, middle.id)).json();

  // Marking the idea on screen as read must not invalidate the URL the member is sitting on.
  assertEquals(step.storyIdea.id, middle.id);
  assertEquals(step.storyIdea.isRead, true);
});

Deno.test("QUERY /api/story-ideas/carousel refuses the member's own idea as an anchor", async () => {
  const other = await registerUser(bystander);
  const own = await (await createIdea(other, { title: "Meine eigene" })).json();

  const response = await carousel(other, own.id);

  // Discovery never shows a member their own idea, so it cannot be a place in this walk.
  assertEquals(response.status, STATUS_CODE.NotFound);
});

Deno.test("QUERY /api/story-ideas/carousel refuses a closed idea as an anchor", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const idea = await (await createIdea(cookie)).json();
  await patchIdea(cookie, idea.id, { status: "closed" });

  const response = await carousel(other, idea.id);

  assertEquals(response.status, STATUS_CODE.NotFound);
});

Deno.test("QUERY /api/story-ideas/carousel refuses an anchor whose author is blocked", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const { middle } = await walkableIdeas(cookie);

  const block = await request("POST", "/api/blocks", other, {
    userId: await getUserId(author),
  });
  assertEquals(block.status, STATUS_CODE.OK);

  const response = await carousel(other, middle.id);

  assertEquals(response.status, STATUS_CODE.NotFound);
});

Deno.test("QUERY /api/story-ideas/carousel answers 404 for an unknown anchor", async () => {
  const other = await registerUser(bystander);

  const response = await carousel(
    other,
    "01a00000-0000-7000-8000-00000000dead",
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});

Deno.test("QUERY /api/story-ideas/carousel needs a session", async () => {
  const response = await carousel("");

  assertEquals(response.status, STATUS_CODE.Unauthorized);
});
