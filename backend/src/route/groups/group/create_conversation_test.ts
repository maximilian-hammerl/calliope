import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
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

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([founder, second, stranger]));

const startConversation = (cookie: string, groupId: string) =>
  request("POST", `/api/groups/${groupId}/conversations`, cookie);

Deno.test("POST /api/groups/{id}/conversations invites every joined administrator", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Offene Runde", "public");
  await addMember(cookie, group.id, second, "administrator");

  const other = await registerUser(stranger);
  const response = await startConversation(other, group.id);
  assertEquals(response.status, STATUS_CODE.Created);

  const chat = await response.json();
  assertEquals(chat.title, "Gruppe: Offene Runde");
  assertEquals(chat.status, "joined");

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
  assertEquals(byStatus.joined?.length, 1);
  assertEquals(byStatus.invited?.length, 2);
});

Deno.test("POST /api/groups/{id}/conversations does not invite writers", async () => {
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
  assertEquals(members.results.length, 2);
  const invited = members.results.find(
    (member: { status: string }) => member.status === "invited",
  );
  assertEquals(invited.username, founder);
});

Deno.test("POST /api/groups/{id}/conversations skips a blocked administrator", async () => {
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
  assertEquals(invited.length, 1);
  assertEquals(invited[0].username, founder);
});

Deno.test("POST /api/groups/{id}/conversations is refused when every administrator has blocked them", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Alle blockiert", "public");

  const other = await registerUser(stranger);
  await request("POST", "/api/blocks", cookie, {
    userId: await getUserId(stranger),
  });

  const response = await startConversation(other, group.id);

  // Nobody left to ask, which is the same answer as a group with no administrator at all.
  assertEquals(response.status, STATUS_CODE.Conflict);
});

Deno.test("POST /api/groups/{id}/conversations hides a private group", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Versteckt", "private");

  const other = await registerUser(stranger);
  const response = await startConversation(other, group.id);

  // 404, not 403: a private group's existence is nobody else's business.
  assertEquals(response.status, STATUS_CODE.NotFound);
});

Deno.test("POST /api/groups/{id}/conversations refuses somebody already in the group", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Schon drin", "public");
  const member = await addMember(cookie, group.id, stranger, "writer");

  const response = await startConversation(member, group.id);

  assertEquals(response.status, STATUS_CODE.Forbidden);
});

Deno.test("POST /api/groups/{id}/conversations refuses somebody holding an invitation", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Schon eingeladen", "public");
  const invited = await registerUser(stranger);
  const invitation = await request(
    "POST",
    `/api/groups/${group.id}/memberships`,
    cookie,
    { userId: await getUserId(stranger), role: "writer" },
  );
  assertEquals(invitation.status, STATUS_CODE.Created);

  const response = await startConversation(invited, group.id);

  // They already have an invitation to answer; a conversation would ask for what is offered.
  assertEquals(response.status, STATUS_CODE.Forbidden);
});

Deno.test("POST /api/groups/{id}/conversations answers 409 when nobody administers the group", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Verwaist", "public");
  await addMember(cookie, group.id, second, "writer");

  // The founder leaves; the writer keeps the group alive but cannot invite anyone.
  const leaving = await request(
    "DELETE",
    `/api/groups/${group.id}/memberships/${await getUserId(founder)}`,
    cookie,
  );
  assertEquals(leaving.status, STATUS_CODE.OK);

  const other = await registerUser(stranger);
  const response = await startConversation(other, group.id);

  assertEquals(response.status, STATUS_CODE.Conflict);
});

Deno.test("POST /api/groups/{id}/conversations needs a session", async () => {
  const cookie = await registerUser(founder);
  const group = await createGroup(cookie, "Ohne Sitzung", "public");

  const response = await startConversation("", group.id);

  assertEquals(response.status, STATUS_CODE.Unauthorized);
});
