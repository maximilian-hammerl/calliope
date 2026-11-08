import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "#/src/http/status.ts";
import { clearRateLimits, createGroup, registerUser, request } from "#/src/test/support.ts";
import { cleanUpFavourites, favouriteFixture, setFavourite } from "#/src/test/favourites.ts";

/**
 * Favourites in the groups list: the flag, the ordering ahead of whatever the reader sorted by,
 * and the filter. Its own file rather than `list_groups_test.ts`, which is about membership.
 */
const { owner, member, outsider } = favouriteFixture("groups");

beforeEach(clearRateLimits);

afterEach(() => cleanUpFavourites([owner, member, outsider]));

const listGroups = (cookie: string, body: Record<string, unknown> = {}) =>
  request("QUERY", "/api/groups", cookie, {
    limit: 50,
    offset: 0,
    membership: "none",
    ...body,
  });

type Row = { id: string; title: string; isFavourite: boolean };

const rowsFor = async (cookie: string, body?: Record<string, unknown>) =>
  (await (await listGroups(cookie, body)).json()).results as Row[];

/**
 * Three public groups whose titles sort in a known order, so a sort can be seen to hold. Named
 * rather than indexed, which is also what keeps the assertions free of non-null assertions.
 */
async function threeGroups(cookie: string) {
  const make = (title: string) => createGroup(cookie, `favourite-groups ${title}`, "public");

  return {
    first: await make("Anfang"),
    middle: await make("Mitte"),
    last: await make("Zuletzt"),
  };
}

test("the list carries the reader's own favourite, and nobody else's", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { first } = await threeGroups(ownerCookie);

  await setFavourite(memberCookie, "writing_group", first.id);

  const mine = await rowsFor(memberCookie);
  assert.equal(mine.find((row) => row.id === first.id)?.isFavourite, true);
  assert(mine.filter((row) => row.id !== first.id).every((row) => !row.isFavourite));

  // The join is bound to one member's id, so the owner sees their own answer rather than theirs.
  const theirs = await rowsFor(ownerCookie, { membership: "any" });
  assert.equal(theirs.find((row) => row.id === first.id)?.isFavourite, false);
});

test("a favourite floats to the top whatever the list is sorted by", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { first, middle, last } = await threeGroups(ownerCookie);

  // The one that sorts last by title, so its position can only come from the favourite.
  await setFavourite(memberCookie, "writing_group", last.id);

  const mine = (rows: Row[]) => rows.filter((row) => row.title.startsWith("favourite-groups"));

  const ascending = mine(await rowsFor(memberCookie, { sortAttribute: "title", sortOrder: "asc" }));
  assert.equal(ascending[0]?.id, last.id);

  // And it is a term *before* the sort rather than one of its options: reversing the sort keeps
  // the favourite first and reorders everything under it.
  const descending = mine(
    await rowsFor(memberCookie, { sortAttribute: "title", sortOrder: "desc" }),
  );
  assert.equal(descending[0]?.id, last.id);
  assert.equal(descending[1]?.id, middle.id);
  assert.equal(ascending[1]?.id, first.id);
});

test("the list can be narrowed to favourites, and counts what it shows", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { first, middle } = await threeGroups(ownerCookie);

  await setFavourite(memberCookie, "writing_group", first.id);
  await setFavourite(memberCookie, "writing_group", middle.id);

  const page = await (await listGroups(memberCookie, { favourite: "only" })).json();
  const rows = page.results as Row[];

  assert(rows.every((row) => row.isFavourite));
  assert.deepEqual(rows.map((row) => row.id).toSorted(), [first.id, middle.id].toSorted());
  // The page and its total come off one builder, so the filter cannot narrow one without the
  // other — never a global count, since another test's groups are in the table too.
  assert.equal(page.totalResults, rows.length);
});

test("without the filter nothing is hidden", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { first, middle, last } = await threeGroups(ownerCookie);

  await setFavourite(memberCookie, "writing_group", first.id);

  const ids = new Set((await rowsFor(memberCookie)).map((row) => row.id));
  for (const group of [first, middle, last]) {
    assert(ids.has(group.id), `${group.id} missing from the list`);
  }
});

test("a group's own page carries the flag too", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { first } = await threeGroups(ownerCookie);

  await setFavourite(memberCookie, "writing_group", first.id);

  const response = await request("GET", `/api/groups/${first.id}`, memberCookie);
  assert.equal(response.status, STATUS_CODE.OK);
  assert.equal((await response.json()).isFavourite, true);
});
