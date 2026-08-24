import { assert, assertEquals } from "@std/assert";
import {
  clearRateLimits,
  createGroup,
  postBody,
  registerUser,
  request,
} from "@/src/test/support.ts";
import {
  cleanUpFavourites,
  favouriteFixture,
  setFavourite,
} from "@/src/test/favourites.ts";

/**
 * Posts are the one kind a favourite does **not** reorder, and the test that says so is the point
 * of this file: a thread is prose and reads in the order it was written. What a favourite earns a
 * post is the thread's own filter.
 */
const { owner, member, outsider } = favouriteFixture("posts");

Deno.test.beforeEach(clearRateLimits);

Deno.test.afterEach(() => cleanUpFavourites([owner, member, outsider]));

type Row = { id: string; text: string; isFavourite: boolean };

const postsOf = async (
  cookie: string,
  groupId: string,
  threadId: string,
  body: Record<string, unknown> = {},
) =>
  (await (await request(
    "QUERY",
    `/api/groups/${groupId}/threads/${threadId}/posts`,
    cookie,
    { limit: 50, offset: 0, ...body },
  )).json()).results as Row[];

/** A thread with three posts, written in the order a thread is read. */
async function aThreadWithPosts(cookie: string) {
  const group = await createGroup(cookie, "Favoriten im Thread", "public");
  const thread = await (await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    cookie,
    { title: "Kapitel" },
  )).json();

  const write = async (text: string) =>
    await (await request(
      "POST",
      `/api/groups/${group.id}/threads/${thread.id}/posts`,
      cookie,
      postBody(text),
    )).json();

  return {
    group,
    thread,
    first: await write("Der erste Absatz."),
    second: await write("Der zweite Absatz."),
    third: await write("Der dritte Absatz."),
  };
}

Deno.test("a favourited post stays where it was written", async () => {
  const ownerCookie = await registerUser(owner);
  const { group, thread, first, second, third } = await aThreadWithPosts(
    ownerCookie,
  );

  await setFavourite(ownerCookie, "writing_post", third.id);

  // Oldest first, unchanged. Hoisting the favourite here would put the end of the chapter above
  // its beginning, which is why posts are the kind that does not reorder.
  const posts = await postsOf(ownerCookie, group.id, thread.id);
  assertEquals(posts.map((row) => row.id), [first.id, second.id, third.id]);
  assertEquals(posts[2]?.isFavourite, true);
  assertEquals(posts[0]?.isFavourite, false);
});

Deno.test("the thread can be narrowed to favourited posts", async () => {
  const ownerCookie = await registerUser(owner);
  const { group, thread, first, third } = await aThreadWithPosts(ownerCookie);

  await setFavourite(ownerCookie, "writing_post", first.id);
  await setFavourite(ownerCookie, "writing_post", third.id);

  const kept = await postsOf(ownerCookie, group.id, thread.id, {
    favourite: "only",
  });

  assert(kept.every((row) => row.isFavourite));
  // Still in reading order among themselves, which is what the filter is for: coming back to the
  // parts of a chapter somebody marked.
  assertEquals(kept.map((row) => row.id), [first.id, third.id]);
});

Deno.test("a post's favourite is the reader's own", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { group, thread, first } = await aThreadWithPosts(ownerCookie);

  await setFavourite(memberCookie, "writing_post", first.id);

  const theirs = await postsOf(ownerCookie, group.id, thread.id);
  assertEquals(theirs.find((row) => row.id === first.id)?.isFavourite, false);

  const mine = await postsOf(memberCookie, group.id, thread.id);
  assertEquals(mine.find((row) => row.id === first.id)?.isFavourite, true);
});
