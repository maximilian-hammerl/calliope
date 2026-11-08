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
import { createIdea, patchIdea, storyIdeaUsers } from "@/src/test/story_ideas.ts";

// Its own two accounts, so another file's cleanup cannot delete them.
const { author, bystander } = storyIdeaUsers("convo");

beforeEach(() => clearRateLimits());
afterEach(() => deleteUsers([author, bystander]));

const startConversation = (cookie: string, ideaId: string) =>
  request("POST", `/api/story-ideas/${ideaId}/conversations`, cookie);

test("POST /api/story-ideas/{id}/conversations invites the author into a titled chat", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const idea = await (await createIdea(cookie, { title: "Leuchtturm" })).json();

  const response = await startConversation(other, idea.id);
  assert.equal(response.status, STATUS_CODE.Created);

  const chat = await response.json();
  assert.equal(chat.title, "Storyidee: Leuchtturm");
  // The asker is in their own chat outright; it is the author who has to consent.
  assert.equal(chat.status, "joined");

  const authorChats = await (await request("QUERY", "/api/chats", cookie, {})).json();
  const invitation = authorChats.results.find((entry: { id: string }) => entry.id === chat.id);
  assert.equal(invitation.status, "invited");
});

test("POST /api/story-ideas/{id}/conversations cuts the title to the chat limit", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const idea = await (await createIdea(cookie, { title: "x".repeat(120) })).json();

  const chat = await (await startConversation(other, idea.id)).json();

  // An idea title may be longer than a chat title; the prefix survives, the tail goes.
  assert.equal(chat.title.length, 80);
  assert.ok(chat.title.includes("Storyidee: "));
});

test("POST /api/story-ideas/{id}/conversations refuses the author's own idea", async () => {
  const cookie = await registerUser(author);
  const idea = await (await createIdea(cookie)).json();

  const response = await startConversation(cookie, idea.id);

  assert.equal(response.status, STATUS_CODE.Forbidden);
});

test("POST /api/story-ideas/{id}/conversations refuses a closed idea", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const idea = await (await createIdea(cookie)).json();
  await patchIdea(cookie, idea.id, { status: "closed" });

  const response = await startConversation(other, idea.id);

  // Closing an idea is the author saying "don't ask", so the button's absence is not the
  // only thing enforcing it.
  assert.equal(response.status, STATUS_CODE.Forbidden);
});

test("POST /api/story-ideas/{id}/conversations is refused when either has blocked the other", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const idea = await (await createIdea(cookie)).json();

  // Blocked by the *author*, so this is the direction the asker cannot see coming.
  const block = await request("POST", "/api/blocks", cookie, {
    userId: await getUserId(bystander),
  });
  assert.equal(block.status, STATUS_CODE.OK);

  const response = await startConversation(other, idea.id);
  assert.equal(response.status, STATUS_CODE.Forbidden);

  // And the idea is not offered to them in the first place. Asserted by id, not by an empty
  // board: other tests and the seed fixture share this database.
  const board = await (await request("QUERY", "/api/story-ideas", other, {})).json();
  const ids = board.results.map((entry: { id: string }) => entry.id);
  assert.equal(ids.includes(idea.id), false);
});

test("POST /api/story-ideas/{id}/conversations answers 404 for an unknown idea", async () => {
  const other = await registerUser(bystander);

  const response = await startConversation(other, "01a00000-0000-7000-8000-00000000dead");

  assert.equal(response.status, STATUS_CODE.NotFound);
});

test("POST /api/story-ideas/{id}/conversations needs a session", async () => {
  const cookie = await registerUser(author);
  const idea = await (await createIdea(cookie)).json();

  const response = await startConversation("", idea.id);

  assert.equal(response.status, STATUS_CODE.Unauthorized);
});
