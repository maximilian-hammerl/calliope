import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "#/src/http/status.ts";
import { clearRateLimits, deleteUsers, registerUser, request } from "#/src/test/support.ts";
import { createIdea, storyIdeaUsers } from "#/src/test/story_ideas.ts";

// Its own two accounts, so another file's cleanup cannot delete them.
const { author, bystander } = storyIdeaUsers("delete");

beforeEach(() => clearRateLimits());
afterEach(() => deleteUsers([author, bystander]));

test("DELETE /api/story-ideas/{id} removes one's own idea", async () => {
  const cookie = await registerUser(author);
  const idea = await (await createIdea(cookie)).json();

  const response = await request("DELETE", `/api/story-ideas/${idea.id}`, cookie);
  assert.equal(response.status, STATUS_CODE.OK);

  const gone = await request("GET", `/api/story-ideas/${idea.id}`, cookie);
  assert.equal(gone.status, STATUS_CODE.NotFound);
});

test("DELETE /api/story-ideas/{id} refuses somebody else's", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const idea = await (await createIdea(cookie)).json();

  const response = await request("DELETE", `/api/story-ideas/${idea.id}`, other);
  assert.equal(response.status, STATUS_CODE.Forbidden);

  const still = await request("GET", `/api/story-ideas/${idea.id}`, cookie);
  assert.equal(still.status, STATUS_CODE.OK);
});
