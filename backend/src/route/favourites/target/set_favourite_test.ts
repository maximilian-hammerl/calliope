import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import {
  clearRateLimits,
  createGroup,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";
import {
  aPublicGroup,
  cleanUpFavourites,
  favouriteFixture,
  favouritesOf,
  setFavourite,
} from "@/src/test/favourites.ts";

const { owner, member, outsider } = favouriteFixture("set");

beforeEach(clearRateLimits);

afterEach(() => cleanUpFavourites([owner, member, outsider]));

test("PUT /api/favourites marks each kind, in the column that kind belongs to", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { group, thread, post, page } = await aPublicGroup(
    ownerCookie,
    "Favoriten",
  );

  const idea = await (await request("POST", "/api/story-ideas", ownerCookie, {
    title: "Eine Idee",
    teaser: "Kurz.",
    synopsis: "Etwas länger.",
  })).json();

  for (
    const [targetType, targetId] of [
      ["writing_group", group.id],
      ["writing_thread", thread.id],
      ["writing_post", post.id],
      ["writing_page", page.id],
      ["story_idea", idea.id],
    ] as const
  ) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    const { status } = await setFavourite(memberCookie, targetType, targetId);
    assert.equal(status, STATUS_CODE.OK, `${targetType} was refused`);
  }

  const stored = await favouritesOf(await getUserId(member));

  // One row per thing, each with exactly one reference set — which is the whole of the table's
  // shape now that no column repeats the kind.
  assert.equal(stored.length, 5);
  for (const row of stored) {
    assert.equal(
      Object.values(row).filter((value) => value !== null).length,
      1,
      "a favourite named more or less than one thing",
    );
  }
  assert.deepEqual(
    stored.map((row) => row.writingGroupId).filter(Boolean),
    [group.id],
  );
  assert.deepEqual(stored.map((row) => row.storyIdeaId).filter(Boolean), [
    idea.id,
  ]);
});

test("favouriting twice is the same as favouriting once", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { group } = await aPublicGroup(ownerCookie, "Zweimal");

  assert.equal(
    (await setFavourite(memberCookie, "writing_group", group.id)).status,
    STATUS_CODE.OK,
  );
  assert.equal(
    (await setFavourite(memberCookie, "writing_group", group.id)).status,
    STATUS_CODE.OK,
  );

  assert.equal((await favouritesOf(await getUserId(member))).length, 1);
});

test("what a member cannot see cannot be favourited", async () => {
  const ownerCookie = await registerUser(owner);
  const outsiderCookie = await registerUser(outsider);

  const group = await createGroup(ownerCookie, "Privat", "private");
  const thread = await (await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    ownerCookie,
    { title: "Geheim" },
  )).json();

  // 404 rather than 403, so favouriting cannot be used to find out that a private group's thread
  // exists — the same rule, through the same resolver, that reporting follows.
  assert.equal(
    (await setFavourite(outsiderCookie, "writing_group", group.id)).status,
    STATUS_CODE.NotFound,
  );
  assert.equal(
    (await setFavourite(outsiderCookie, "writing_thread", thread.id)).status,
    STATUS_CODE.NotFound,
  );

  assert.equal((await favouritesOf(await getUserId(outsider))).length, 0);
});

test("a member's own group is favouritable, unlike their own report", async () => {
  const ownerCookie = await registerUser(owner);
  const { group } = await aPublicGroup(ownerCookie, "Meine eigene");

  // Deliberately allowed: keeping your own group at the top of your own list is ordinary, and
  // nothing here is about somebody else the way reporting and marking-read are.
  assert.equal(
    (await setFavourite(ownerCookie, "writing_group", group.id)).status,
    STATUS_CODE.OK,
  );

  assert.equal((await favouritesOf(await getUserId(owner))).length, 1);
});

test("one member's favourite is not another's", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { group } = await aPublicGroup(ownerCookie, "Geteilt");

  await setFavourite(memberCookie, "writing_group", group.id);

  assert.equal((await favouritesOf(await getUserId(member))).length, 1);
  assert.equal((await favouritesOf(await getUserId(owner))).length, 0);
});

test("a favourite goes with the thing it names", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { group, thread, post } = await aPublicGroup(
    ownerCookie,
    "Vergänglich",
  );

  await setFavourite(memberCookie, "writing_post", post.id);
  assert.equal((await favouritesOf(await getUserId(member))).length, 1);

  assert.equal(
    (await request(
      "DELETE",
      `/api/groups/${group.id}/threads/${thread.id}/posts/${post.id}`,
      ownerCookie,
      undefined,
    )).status,
    STATUS_CODE.OK,
  );

  // CASCADE, not SET NULL: a favourite of something deleted means nothing, which is the whole
  // reason this table needs no `target_type` where `report` does.
  assert.equal((await favouritesOf(await getUserId(member))).length, 0);
});

test("PUT /api/favourites needs a session", async () => {
  assert.equal(
    (await request(
      "PUT",
      "/api/favourites/writing_group/01a00000-0000-7000-8000-00000000ffff",
      "",
    )).status,
    STATUS_CODE.Unauthorized,
  );
});

test("an unknown kind is refused by the schema", async () => {
  const memberCookie = await registerUser(member);

  assert.equal(
    (await setFavourite(
      memberCookie,
      "user",
      "01a00000-0000-7000-8000-00000000ffff",
    )).status,
    STATUS_CODE.BadRequest,
  );
});
