import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "@/src/http/status.ts";
import {
  addMember,
  clearRateLimits,
  createGroup,
  deleteUsers,
  getUserId,
  registerUser,
  request,
} from "@/src/test/support.ts";

const founder = "group-conversation-test-founder";
const second = "group-conversation-test-zweite";
const stranger = "group-conversation-test-stranger";

beforeEach(() => clearRateLimits());
afterEach(() => deleteUsers([founder, second, stranger]));

const startConversation = (cookie: string, groupId: string) =>
  request("POST", `/api/groups/${groupId}/conversations`, cookie);

test("POST /api/groups/{id}/conversations invites every joined administrator", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Offene Runde", "public");
  await addMember(cookie, group.id, second, "administrator");

  const other = await registerUser(stranger);
  const response = await startConversation(other, group.id);
  assert.equal(response.status, STATUS_CODE.Created);

  const chat = await response.json();
  assert.equal(chat.title, "Gruppe: Offene Runde");
  assert.equal(chat.status, "joined");

  const members = await (await request(
    "QUERY",
    `/api/chats/${chat.id}/memberships`,
    other,
    {},
  )).json();
  const byStatus = Object.groupBy(
    members.results,
    (member: { status: string }) => member.status,
  );

  // The asker, joined — plus both administrators, each holding their own invitation.
  assert.equal(byStatus.joined?.length, 1);
  assert.equal(byStatus.invited?.length, 2);
});

test("POST /api/groups/{id}/conversations does not invite writers", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Mit Schreibern", "public");
  await addMember(cookie, group.id, second, "writer");

  const other = await registerUser(stranger);
  const chat = await (await startConversation(other, group.id)).json();

  const members = await (await request(
    "QUERY",
    `/api/chats/${chat.id}/memberships`,
    other,
    {},
  )).json();

  // Only the founder is invited: asking in is administrators' business.
  assert.equal(members.results.length, 2);
  const invited = members.results.find(
    (member: { status: string }) => member.status === "invited",
  );
  assert.equal(invited.username, founder);
});

test("POST /api/groups/{id}/conversations skips a blocked administrator", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Zwei Verwaltende", "public");
  const secondCookie = await addMember(
    cookie,
    group.id,
    second,
    "administrator",
  );

  const other = await registerUser(stranger);
  // One of the two wants nothing to do with the asker; the other still can be reached.
  await request("POST", "/api/blocks", secondCookie, {
    userId: await getUserId(stranger),
  });

  const chat = await (await startConversation(other, group.id)).json();
  const members = await (await request(
    "QUERY",
    `/api/chats/${chat.id}/memberships`,
    other,
    {},
  )).json();
  const invited = members.results.filter(
    (member: { status: string }) => member.status === "invited",
  );

  // A group must not become unreachable because one administrator blocked one person.
  assert.equal(invited.length, 1);
  assert.equal(invited[0].username, founder);
});

test("POST /api/groups/{id}/conversations is refused when every administrator has blocked them", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Alle blockiert", "public");

  const other = await registerUser(stranger);
  await request("POST", "/api/blocks", cookie, {
    userId: await getUserId(stranger),
  });

  const response = await startConversation(other, group.id);

  // Nobody left to ask, which is the same answer as a group with no administrator at all.
  assert.equal(response.status, STATUS_CODE.Conflict);
});

test("POST /api/groups/{id}/conversations hides a private group", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Versteckt", "private");

  const other = await registerUser(stranger);
  const response = await startConversation(other, group.id);

  // 404, not 403: a private group's existence is nobody else's business.
  assert.equal(response.status, STATUS_CODE.NotFound);
});

test("POST /api/groups/{id}/conversations refuses somebody already in the group", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Schon drin", "public");
  const member = await addMember(cookie, group.id, stranger, "writer");

  const response = await startConversation(member, group.id);

  assert.equal(response.status, STATUS_CODE.Forbidden);
});

test("POST /api/groups/{id}/conversations refuses somebody holding an invitation", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Schon eingeladen", "public");
  const invited = await registerUser(stranger);
  const invitation = await request(
    "POST",
    `/api/groups/${group.id}/memberships`,
    cookie,
    { userId: await getUserId(stranger), role: "writer" },
  );
  assert.equal(invitation.status, STATUS_CODE.Created);

  const response = await startConversation(invited, group.id);

  // They already have an invitation to answer; a conversation would ask for what is offered.
  assert.equal(response.status, STATUS_CODE.Forbidden);
});

test("POST /api/groups/{id}/conversations answers 409 when nobody administers the group", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Verwaist", "public");
  await addMember(cookie, group.id, second, "writer");

  // The founder leaves; the writer keeps the group alive but cannot invite anyone.
  const leaving = await request(
    "DELETE",
    `/api/groups/${group.id}/memberships/${await getUserId(founder)}`,
    cookie,
  );
  assert.equal(leaving.status, STATUS_CODE.OK);

  const other = await registerUser(stranger);
  const response = await startConversation(other, group.id);

  assert.equal(response.status, STATUS_CODE.Conflict);
});

test("POST /api/groups/{id}/conversations needs a session", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Ohne Sitzung", "public");

  const response = await startConversation("", group.id);

  assert.equal(response.status, STATUS_CODE.Unauthorized);
});
