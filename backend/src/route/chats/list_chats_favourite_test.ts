import { assert, assertEquals } from "@std/assert";
import {
  clearRateLimits,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";
import {
  cleanUpFavourites,
  favouriteFixture,
  setFavourite,
} from "@/src/test/favourites.ts";

/**
 * The chats list's favourite: the flag, the ordering and that it is the reader's own. A chat is the
 * one favouritable kind both members are inside, so it is also the clearest place to show that
 * `withFavourite`'s reader argument scopes what it returns.
 */
const { owner, member } = favouriteFixture("chats");

Deno.test.beforeEach(clearRateLimits);

Deno.test.afterEach(() => cleanUpFavourites([owner, member]));

type Row = { id: string; title: string; isFavourite: boolean };

const rowsFor = async (cookie: string, body: Record<string, unknown> = {}) =>
  (await (await request("QUERY", "/api/chats", cookie, { limit: 50, ...body }))
    .json()).results as Row[];

/** Two chats the other member is in, so both have the same rows to disagree about. */
async function twoChats(ownerCookie: string, memberName: string) {
  const otherId = await getUserId(memberName);

  const make = async (title: string) => {
    const chat = await (await request("POST", "/api/chats", ownerCookie, {
      title,
    })).json();
    await request(
      "POST",
      `/api/chats/${chat.id}/memberships`,
      ownerCookie,
      { userId: otherId },
    );
    return chat;
  };

  return {
    first: await make("favourite-chats Anfang"),
    second: await make("favourite-chats Zuletzt"),
  };
}

Deno.test("a chat's favourite is the reader's own", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { first } = await twoChats(ownerCookie, member);

  await setFavourite(memberCookie, "chat_group", first.id);

  const theirs = await rowsFor(ownerCookie);
  assertEquals(theirs.find((row) => row.id === first.id)?.isFavourite, false);

  const mine = await rowsFor(memberCookie);
  assertEquals(mine.find((row) => row.id === first.id)?.isFavourite, true);
});

Deno.test("the chats list puts a favourite first, and narrows to it", async () => {
  const ownerCookie = await registerUser(owner);
  const memberCookie = await registerUser(member);
  const { first } = await twoChats(ownerCookie, member);

  await setFavourite(memberCookie, "chat_group", first.id);

  const rows = await rowsFor(memberCookie);
  assertEquals(rows[0]?.id, first.id);

  const only = await rowsFor(memberCookie, { favourite: "only" });
  assert(only.every((row) => row.isFavourite));
  assertEquals(only.map((row) => row.id), [first.id]);
});
