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
 * Listing threads is not a list endpoint — it returns every thread with no paging and no sort of
 * the reader's own. A favourite marks a row and no longer moves it: the tree nests these by
 * folder, and a favourite jumping above its siblings makes a member's own structure look
 * unstable. That is what this file covers.
 */
const { owner, member, outsider } = favouriteFixture("threads");

Deno.test.beforeEach(clearRateLimits);

Deno.test.afterEach(() => cleanUpFavourites([owner, member, outsider]));

type Row = { id: string; title: string; isFavourite: boolean };

const threadsOf = async (cookie: string, groupId: string) =>
  (await (await request("GET", `/api/groups/${groupId}/threads`, cookie))
    .json()).results as Row[];

/** Three threads written in order, so the ordering is known before a favourite. */
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

Deno.test("a favourite marks a thread without moving it", async () => {
  const ownerCookie = await registerUser(owner);
  const { group, oldest, middle, newest } = await aGroupWithThreads(
    ownerCookie,
  );

  const before = await threadsOf(ownerCookie, group.id);
  assertEquals(before.map((row) => row.id), [newest.id, middle.id, oldest.id]);

  await setFavourite(ownerCookie, "writing_thread", oldest.id);

  const after = await threadsOf(ownerCookie, group.id);
  // Most recently written in first, favourite or not: the mark is the only thing that changed.
  assertEquals(after.map((row) => row.id), [newest.id, middle.id, oldest.id]);
  assertEquals(after.find((row) => row.id === oldest.id)?.isFavourite, true);
});

Deno.test("the favourite mark is the reader's own", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { group, oldest } = await aGroupWithThreads(ownerCookie);

  await setFavourite(memberCookie, "writing_thread", oldest.id);

  const theirs = await threadsOf(memberCookie, group.id);
  const ours = await threadsOf(ownerCookie, group.id);

  assertEquals(theirs.find((row) => row.id === oldest.id)?.isFavourite, true);
  assertEquals(ours.find((row) => row.id === oldest.id)?.isFavourite, false);
  // Nobody's favourite changes anybody's order, including their own.
  assertEquals(theirs.map((row) => row.id), ours.map((row) => row.id));
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
