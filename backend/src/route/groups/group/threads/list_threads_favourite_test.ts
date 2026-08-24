import { assertEquals } from "@std/assert";
import {
  clearRateLimits,
  createGroup,
  registerUser,
  request,
} from "@/src/test/support.ts";
import {
  cleanUpFavourites,
  favouriteFixture,
  setFavourite,
} from "@/src/test/favourites.ts";

/**
 * The thread strip is not a list endpoint — it returns every thread with no paging and no sort of
 * the reader's own — so its favourites-first term is written in the service rather than handed to
 * `listResultsWithCount`. That is what this file covers.
 */
const { owner, member, outsider } = favouriteFixture("threads");

Deno.test.beforeEach(clearRateLimits);

Deno.test.afterEach(() => cleanUpFavourites([owner, member, outsider]));

type Row = { id: string; title: string; isFavourite: boolean };

const threadsOf = async (cookie: string, groupId: string) =>
  (await (await request("GET", `/api/groups/${groupId}/threads`, cookie))
    .json()).results as Row[];

/** Three threads written in order, so the strip's own ordering is known before a favourite. */
async function aGroupWithThreads(cookie: string) {
  const group = await createGroup(cookie, "Favoriten im Strip", "public");

  const make = async (title: string) =>
    await (await request(
      "POST",
      `/api/groups/${group.id}/threads`,
      cookie,
      { title },
    )).json();

  return {
    group,
    oldest: await make("Zuerst"),
    middle: await make("Dann"),
    newest: await make("Zuletzt"),
  };
}

Deno.test("the strip puts a favourite first, and keeps the rest by activity", async () => {
  const ownerCookie = await registerUser(owner);
  const { group, oldest, newest } = await aGroupWithThreads(ownerCookie);

  // Newest first is the strip's resting order, so the oldest is the one whose position can only
  // come from the favourite.
  assertEquals((await threadsOf(ownerCookie, group.id))[0]?.id, newest.id);

  await setFavourite(ownerCookie, "writing_thread", oldest.id);

  const strip = await threadsOf(ownerCookie, group.id);
  assertEquals(strip[0]?.id, oldest.id);
  assertEquals(strip[0]?.isFavourite, true);
  // Everything under it keeps the order it had.
  assertEquals(strip[1]?.id, newest.id);
});

Deno.test("the strip's favourite is the reader's own", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { group, oldest } = await aGroupWithThreads(ownerCookie);

  await setFavourite(memberCookie, "writing_thread", oldest.id);

  // The member sees it first; the owner sees their own answer and their own order.
  assertEquals((await threadsOf(memberCookie, group.id))[0]?.id, oldest.id);

  const theirs = await threadsOf(ownerCookie, group.id);
  assertEquals(theirs.find((row) => row.id === oldest.id)?.isFavourite, false);
  assertEquals(theirs[0]?.id !== oldest.id, true);
});

Deno.test("a thread's own page carries the flag", async () => {
  const ownerCookie = await registerUser(owner);
  const { group, oldest } = await aGroupWithThreads(ownerCookie);

  await setFavourite(ownerCookie, "writing_thread", oldest.id);

  const thread = await (await request(
    "GET",
    `/api/groups/${group.id}/threads/${oldest.id}`,
    ownerCookie,
  )).json();
  assertEquals(thread.isFavourite, true);
});
