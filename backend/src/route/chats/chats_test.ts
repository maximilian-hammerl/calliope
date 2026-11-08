import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import {
  clearRateLimits,
  deleteUsers,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";

const founder = "chats-founder";
const invited = "chats-invited";
const outsider = "chats-outsider";

beforeEach(clearRateLimits);
afterEach(() => deleteUsers([founder, invited, outsider]));

/** A chat with its founder, and somebody invited who has not accepted yet. */
async function chat() {
  const founderCookie = await registerUser(founder);
  const invitedCookie = await registerUser(invited);
  const invitedId = await getUserId(invited);

  const created = await (
    await request("POST", "/api/chats", founderCookie, {
      title: "Nachtmarkt",
    })
  ).json();

  const invitation = await request("POST", `/api/chats/${created.id}/memberships`, founderCookie, {
    userId: invitedId,
  });
  assert.equal(invitation.status, STATUS_CODE.Created);

  return { founderCookie, invitedCookie, invitedId, chat: created };
}

const listChats = async (cookie: string) =>
  await (await request("QUERY", "/api/chats", cookie, {})).json();

const listMessages = async (cookie: string, chatId: string, body: unknown = {}) =>
  await request("QUERY", `/api/chats/${chatId}/messages`, cookie, body);

test("a new chat has its founder in it and nobody else", async () => {
  const founderCookie = await registerUser(founder);

  const response = await request("POST", "/api/chats", founderCookie, {
    title: "Nachtmarkt",
  });

  assert.equal(response.status, STATUS_CODE.Created);
  const created = await response.json();
  assert.equal(created.title, "Nachtmarkt");
  assert.equal(created.createdByUsername, founder);
  assert.equal(created.unreadMessages, 0);
});

test("an invitation is told about, and does not join anybody", async () => {
  const { invitedCookie } = await chat();

  const notifications = await (
    await request("QUERY", "/api/notifications", invitedCookie, {})
  ).json();
  assert.equal(notifications.totalResults, 1);
  assert.equal(notifications.results[0].type, "invited_to_chat_group");
  assert.equal(notifications.results[0].chatGroupTitle, "Nachtmarkt");

  // Visible, because they have to see what they are being asked to join.
  assert.equal((await listChats(invitedCookie)).totalResults, 1);
});

test("an invitation may not read or write until it is accepted", async () => {
  const { invitedCookie, chat: created } = await chat();

  assert.equal((await listMessages(invitedCookie, created.id)).status, STATUS_CODE.Forbidden);

  const sent = await request("POST", `/api/chats/${created.id}/messages`, invitedCookie, {
    text: "Hallo?",
  });
  assert.equal(sent.status, STATUS_CODE.Forbidden);
});

test("accepting lets the member take part", async () => {
  const { invitedCookie, chat: created } = await chat();

  const accepted = await request(
    "POST",
    `/api/chats/${created.id}/memberships/me/accept`,
    invitedCookie,
  );
  assert.equal(accepted.status, STATUS_CODE.OK);
  assert.equal((await accepted.json()).status, "joined");

  assert.equal((await listMessages(invitedCookie, created.id)).status, STATUS_CODE.OK);
});

test("somebody outside the chat is told it does not exist", async () => {
  const { chat: created } = await chat();
  const outsiderCookie = await registerUser(outsider);

  // 404 rather than 403: its existence is not theirs to learn.
  assert.equal((await listMessages(outsiderCookie, created.id)).status, STATUS_CODE.NotFound);
  assert.equal((await listChats(outsiderCookie)).totalResults, 0);
});

test("unread counts the other person's messages, not your own", async () => {
  const { founderCookie, invitedCookie, chat: created } = await chat();
  await request("POST", `/api/chats/${created.id}/memberships/me/accept`, invitedCookie);

  await request("POST", `/api/chats/${created.id}/messages`, founderCookie, {
    text: "Die Laternen gingen aus.",
  });

  const forInvited = await listChats(invitedCookie);
  assert.equal(forInvited.results[0].unreadMessages, 1);

  const forFounder = await listChats(founderCookie);
  assert.equal(forFounder.results[0].unreadMessages, 0, "your own words are not news");

  await request("POST", `/api/chats/${created.id}/read`, invitedCookie);
  assert.equal((await listChats(invitedCookie)).results[0].unreadMessages, 0);
});

test("messages page by cursor, oldest reachable from newest", async () => {
  const { founderCookie, chat: created } = await chat();

  for (const text of ["eins", "zwei", "drei"]) {
    // deno-lint-ignore no-await-in-loop -- sequential on purpose, one case per iteration
    await request("POST", `/api/chats/${created.id}/messages`, founderCookie, {
      text,
    });
  }

  const first = await (await listMessages(founderCookie, created.id, { limit: 2 })).json();
  assert.deepEqual(
    first.results.map((m: { text: string }) => m.text),
    ["drei", "zwei"],
  );

  const second = await (
    await listMessages(founderCookie, created.id, {
      limit: 2,
      before: first.nextCursor,
    })
  ).json();
  assert.deepEqual(
    second.results.map((m: { text: string }) => m.text),
    ["eins"],
  );
  assert.equal(second.nextCursor, null, "the beginning has been reached");
});

test("leaving takes the chat with the last member out", async () => {
  const { founderCookie, invitedCookie, chat: created } = await chat();
  await request("POST", `/api/chats/${created.id}/memberships/me/accept`, invitedCookie);

  await request("DELETE", `/api/chats/${created.id}/memberships/me`, founderCookie);
  assert.equal((await listChats(invitedCookie)).totalResults, 1, "one member is still in it");

  await request("DELETE", `/api/chats/${created.id}/memberships/me`, invitedCookie);
  assert.equal((await listChats(invitedCookie)).totalResults, 0);
});

test("declining an invitation removes its notification too", async () => {
  const { invitedCookie, chat: created } = await chat();

  await request("DELETE", `/api/chats/${created.id}/memberships/me`, invitedCookie);

  const notifications = await (
    await request("QUERY", "/api/notifications", invitedCookie, {})
  ).json();
  assert.equal(notifications.totalResults, 0);
});

test("the member list shows who is in a chat and who is still deciding", async () => {
  const { founderCookie, chat: created } = await chat();

  const response = await request(
    "QUERY",
    `/api/chats/${created.id}/memberships`,
    founderCookie,
    {},
  );

  assert.equal(response.status, STATUS_CODE.OK);
  const page = await response.json();
  assert.equal(page.totalResults, 2);
  assert.deepEqual(
    page.results
      .map((m: { username: string; status: string }) => `${m.username}:${m.status}`)
      .toSorted(),
    [`${founder}:joined`, `${invited}:invited`].toSorted(),
  );
});

test("an invitation may see who it would be joining", async () => {
  const { invitedCookie, chat: created } = await chat();

  // Visibility, not membership: deciding whether to accept needs to know who is there.
  const response = await request(
    "QUERY",
    `/api/chats/${created.id}/memberships`,
    invitedCookie,
    {},
  );

  assert.equal(response.status, STATUS_CODE.OK);
  assert.equal((await response.json()).totalResults, 2);
});

test("somebody outside the chat cannot see who is in it", async () => {
  const { chat: created } = await chat();
  const outsiderCookie = await registerUser(outsider);

  const response = await request(
    "QUERY",
    `/api/chats/${created.id}/memberships`,
    outsiderCookie,
    {},
  );

  assert.equal(response.status, STATUS_CODE.NotFound);
});

test("a member may invite, and inviting twice conflicts", async () => {
  const { founderCookie, invitedCookie, chat: created } = await chat();
  await request("POST", `/api/chats/${created.id}/memberships/me/accept`, invitedCookie);
  const outsiderCookie = await registerUser(outsider);
  const outsiderId = await getUserId(outsider);

  // Anybody in the chat may invite, not only whoever started it.
  const invitation = await request("POST", `/api/chats/${created.id}/memberships`, invitedCookie, {
    userId: outsiderId,
  });
  assert.equal(invitation.status, STATUS_CODE.Created);
  assert.equal((await invitation.json()).status, "invited");

  const again = await request("POST", `/api/chats/${created.id}/memberships`, founderCookie, {
    userId: outsiderId,
  });
  assert.equal(again.status, STATUS_CODE.Conflict);

  // And they were told, once.
  const notifications = await (
    await request("QUERY", "/api/notifications", outsiderCookie, {})
  ).json();
  assert.equal(notifications.totalResults, 1);
  assert.equal(notifications.results[0].type, "invited_to_chat_group");
});

test("QUERY /api/chats needs a session", async () => {
  const response = await request("QUERY", "/api/chats", "", {});

  assert.equal(response.status, STATUS_CODE.Unauthorized);
  assert.ok(!response.headers.has("set-cookie"));
});
