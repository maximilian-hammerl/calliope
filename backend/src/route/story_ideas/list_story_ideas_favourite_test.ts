import { assert, assertEquals } from "@std/assert";
import { clearRateLimits, registerUser } from "@/src/test/support.ts";
import { createIdea, listIdeas } from "@/src/test/story_ideas.ts";
import {
  cleanUpFavourites,
  favouriteFixture,
  setFavourite,
} from "@/src/test/favourites.ts";

/**
 * The board's favourite: the flag, the ordering ahead of whatever the reader sorted by, and that it
 * is the reader's own. That last one is what covers `withFavourite`'s reader argument here —
 * nothing type-checks which id a call site passes, so only a second member can show it is right.
 */
const { owner, member } = favouriteFixture("ideas");

Deno.test.beforeEach(clearRateLimits);

Deno.test.afterEach(() => cleanUpFavourites([owner, member]));

type Row = { id: string; title: string; isFavourite: boolean };

const rowsFor = async (cookie: string, body: Record<string, unknown> = {}) =>
  (await (await listIdeas(cookie, {
    limit: 50,
    offset: 0,
    readerState: "any",
    status: "any",
    ...body,
  })).json()).results as Row[];

/** Two ideas by one author, so a second member has something of somebody else's to mark. */
async function twoIdeas(cookie: string) {
  const first = await (await createIdea(cookie, {
    title: "favourite-ideas Anfang",
  })).json();
  const second = await (await createIdea(cookie, {
    title: "favourite-ideas Zuletzt",
  })).json();
  return { first, second };
}

Deno.test("an idea's favourite is the reader's own", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { first } = await twoIdeas(ownerCookie);

  await setFavourite(memberCookie, "story_idea", first.id);

  const theirs = await rowsFor(ownerCookie, { author: "mine" });
  assertEquals(theirs.find((row) => row.id === first.id)?.isFavourite, false);

  const mine = await rowsFor(memberCookie, { author: "others" });
  assertEquals(mine.find((row) => row.id === first.id)?.isFavourite, true);
});

Deno.test("the board puts a favourite first, and narrows to it", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { first } = await twoIdeas(ownerCookie);

  // Newest first is the board's resting order, so the older idea's position can only come from
  // the favourite.
  const before = await rowsFor(memberCookie, {
    author: "others",
    sortAttribute: "createdAt",
    sortOrder: "desc",
  });
  assert(before.findIndex((row) => row.id === first.id) > 0);

  await setFavourite(memberCookie, "story_idea", first.id);

  const after = await rowsFor(memberCookie, {
    author: "others",
    sortAttribute: "createdAt",
    sortOrder: "desc",
  });
  assertEquals(after[0]?.id, first.id);

  const only = await rowsFor(memberCookie, {
    author: "others",
    favourite: "only",
  });
  assert(only.every((row) => row.isFavourite));
  assertEquals(only.map((row) => row.id), [first.id]);
});
