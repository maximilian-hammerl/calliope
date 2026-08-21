import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";
import {
  blocked,
  blocker,
  blockMember,
  listBlocks,
  unblockMember,
} from "@/src/test/blocks.ts";

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([blocker, blocked]));

Deno.test("POST /api/blocks refuses contact in both directions", async () => {
  const cookie = await registerUser(blocker);
  const otherCookie = await registerUser(blocked);
  const blockedId = await getUserId(blocked);
  const blockerId = await getUserId(blocker);

  assertEquals((await blockMember(cookie, blockedId)).status, STATUS_CODE.OK);

  const ownGroup = await createGroup(cookie, "Meine Gruppe");
  const theirGroup = await createGroup(otherCookie, "Ihre Gruppe");

  // The blocker cannot invite them...
  const outward = await request(
    "POST",
    `/api/groups/${ownGroup.id}/memberships`,
    cookie,
    { userId: blockedId, role: "writer" },
  );
  assertEquals(outward.status, STATUS_CODE.Forbidden);

  // ...and, the half that matters, they cannot invite the blocker either.
  const inward = await request(
    "POST",
    `/api/groups/${theirGroup.id}/memberships`,
    otherCookie,
    { userId: blockerId, role: "writer" },
  );
  assertEquals(inward.status, STATUS_CODE.Forbidden);
});

Deno.test("POST /api/blocks withdraws the invitations still unanswered", async () => {
  const cookie = await registerUser(blocker);
  const otherCookie = await registerUser(blocked);
  const blockedId = await getUserId(blocked);

  const group = await createGroup(cookie, "Mit Einladung");
  const invitation = await request(
    "POST",
    `/api/groups/${group.id}/memberships`,
    cookie,
    { userId: blockedId, role: "writer" },
  );
  assertEquals(invitation.status, STATUS_CODE.Created);

  const chat = await (await request("POST", "/api/chats", cookie, {
    title: "Mit Einladung",
  })).json();
  const chatInvitation = await request(
    "POST",
    `/api/chats/${chat.id}/memberships`,
    cookie,
    { userId: blockedId },
  );
  assertEquals(chatInvitation.status, STATUS_CODE.Created);

  await blockMember(cookie, blockedId);

  // An unanswered invitation is an outstanding contact attempt, so it goes with the block —
  // for groups and chats alike.
  const groups = await (await request("QUERY", "/api/groups", otherCookie, {
    membership: "invited",
  })).json();
  assertEquals(groups.results.length, 0);

  const chats = await (await request("QUERY", "/api/chats", otherCookie, {}))
    .json();
  assertEquals(chats.results.length, 0);
});

Deno.test("POST /api/blocks leaves a group they are both in alone", async () => {
  const cookie = await registerUser(blocker);
  const otherCookie = await registerUser(blocked);
  const blockedId = await getUserId(blocked);

  const group = await createGroup(cookie, "Gemeinsam");
  await request("POST", `/api/groups/${group.id}/memberships`, cookie, {
    userId: blockedId,
    role: "writer",
  });
  await request(
    "POST",
    `/api/groups/${group.id}/memberships/me/accept`,
    otherCookie,
  );

  await blockMember(cookie, blockedId);

  // Nothing is removed retroactively: shared writing is joint work, and leaving is their own
  // act. This is the deliberate residual, not an oversight.
  const stillThere = await request(
    "GET",
    `/api/groups/${group.id}`,
    otherCookie,
  );
  assertEquals(stillThere.status, STATUS_CODE.OK);
  assertEquals((await stillThere.json()).status, "joined");
});

Deno.test("POST /api/blocks hides them from the member list and search", async () => {
  const cookie = await registerUser(blocker);
  await registerUser(blocked);
  const blockedId = await getUserId(blocked);

  const before = await (await request("QUERY", "/api/users", cookie, {
    search: blocked,
  })).json();
  assertEquals(before.results.length, 1);

  await blockMember(cookie, blockedId);

  const after = await (await request("QUERY", "/api/users", cookie, {
    search: blocked,
  })).json();
  assertEquals(after.results.length, 0);

  const search = await (await request("QUERY", "/api/search", cookie, {
    search: blocked,
  })).json();
  assertEquals(search.users.results.length, 0);
});

Deno.test("POST /api/blocks is idempotent and refuses oneself", async () => {
  const cookie = await registerUser(blocker);
  await registerUser(blocked);
  const blockedId = await getUserId(blocked);

  assertEquals((await blockMember(cookie, blockedId)).status, STATUS_CODE.OK);
  // Twice is not an error: the button cannot know what a second tab already did.
  assertEquals((await blockMember(cookie, blockedId)).status, STATUS_CODE.OK);

  const page = await (await listBlocks(cookie)).json();
  assertEquals(page.results.length, 1);
  assertEquals(page.results[0].username, blocked);

  const self = await blockMember(cookie, await getUserId(blocker));
  assertEquals(self.status, STATUS_CODE.Forbidden);
});

Deno.test("DELETE /api/blocks/{userId} allows contact again", async () => {
  const cookie = await registerUser(blocker);
  await registerUser(blocked);
  const blockedId = await getUserId(blocked);

  await blockMember(cookie, blockedId);
  assertEquals(
    (await unblockMember(cookie, blockedId)).status,
    STATUS_CODE.OK,
  );

  const group = await createGroup(cookie, "Wieder offen");
  const invitation = await request(
    "POST",
    `/api/groups/${group.id}/memberships`,
    cookie,
    { userId: blockedId, role: "writer" },
  );
  assertEquals(invitation.status, STATUS_CODE.Created);

  // Nothing is blocked any more, so a second withdrawal has nothing to withdraw.
  assertEquals(
    (await unblockMember(cookie, blockedId)).status,
    STATUS_CODE.NotFound,
  );
});

Deno.test("QUERY /api/blocks is nobody else's business", async () => {
  const cookie = await registerUser(blocker);
  const otherCookie = await registerUser(blocked);
  await blockMember(cookie, await getUserId(blocked));

  // The blocked member cannot read that they are blocked; their own list is empty.
  const theirs = await (await listBlocks(otherCookie)).json();
  assertEquals(theirs.results.length, 0);

  assertEquals((await listBlocks("")).status, STATUS_CODE.Unauthorized);
});
