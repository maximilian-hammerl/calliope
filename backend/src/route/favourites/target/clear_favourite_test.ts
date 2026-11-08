import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import { clearRateLimits, getUserId, registerUser, request } from "@/src/test/support.ts";
import {
  aPublicGroup,
  cleanUpFavourites,
  clearFavourite,
  favouriteFixture,
  favouritesOf,
  setFavourite,
} from "@/src/test/favourites.ts";

const { owner, member, outsider } = favouriteFixture("clear");

beforeEach(clearRateLimits);

afterEach(() => cleanUpFavourites([owner, member, outsider]));

test("DELETE /api/favourites removes the one it names and nothing else", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { group, thread } = await aPublicGroup(ownerCookie, "Zwei Favoriten");

  await setFavourite(memberCookie, "writing_group", group.id);
  await setFavourite(memberCookie, "writing_thread", thread.id);

  assert.equal(
    (await clearFavourite(memberCookie, "writing_group", group.id)).status,
    STATUS_CODE.OK,
  );

  const stored = await favouritesOf(await getUserId(member));
  assert.equal(stored.length, 1);
  assert.equal(stored[0]?.writingThreadId, thread.id);
});

test("removing one that was never a favourite answers the same way", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { group } = await aPublicGroup(ownerCookie, "Nie gemerkt");

  // Absent is the state being asked for, so there is nothing here to report as missing.
  assert.equal(
    (await clearFavourite(memberCookie, "writing_group", group.id)).status,
    STATUS_CODE.OK,
  );
  assert.equal((await favouritesOf(await getUserId(member))).length, 0);
});

test("a favourite can be removed after it stops being visible", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { group } = await aPublicGroup(ownerCookie, "Wird privat");

  await setFavourite(memberCookie, "writing_group", group.id);

  assert.equal(
    (
      await request("PATCH", `/api/groups/${group.id}`, ownerCookie, {
        visibility: "private",
      })
    ).status,
    STATUS_CODE.OK,
  );

  // Setting one asks whether the member can see it; removing one deliberately does not. A group
  // gone private is exactly the favourite somebody most wants rid of, and refusing would leave
  // them holding a row they cannot reach.
  assert.equal(
    (await setFavourite(memberCookie, "writing_group", group.id)).status,
    STATUS_CODE.NotFound,
  );
  assert.equal(
    (await clearFavourite(memberCookie, "writing_group", group.id)).status,
    STATUS_CODE.OK,
  );
  assert.equal((await favouritesOf(await getUserId(member))).length, 0);
});

test("removing cannot reach another member's favourite", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const outsiderCookie = await registerUser(outsider);
  const { group } = await aPublicGroup(ownerCookie, "Fremder Favorit");

  await setFavourite(memberCookie, "writing_group", group.id);

  assert.equal(
    (await clearFavourite(outsiderCookie, "writing_group", group.id)).status,
    STATUS_CODE.OK,
  );

  // It answered the same way, and took nothing: the delete is scoped to the caller's own id.
  assert.equal((await favouritesOf(await getUserId(member))).length, 1);
});

test("DELETE /api/favourites needs a session", async () => {
  assert.equal(
    (
      await request(
        "DELETE",
        "/api/favourites/writing_group/01a00000-0000-7000-8000-00000000ffff",
        "",
      )
    ).status,
    STATUS_CODE.Unauthorized,
  );
});
