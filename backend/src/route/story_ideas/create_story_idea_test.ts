import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { STATUS_CODE } from "#/src/http/status.ts";
import { clearRateLimits, deleteUsers, registerUser } from "#/src/test/support.ts";
import { createIdea, storyIdeaUsers } from "#/src/test/story_ideas.ts";

// Its own two accounts, so another file's cleanup cannot delete them.
const { author } = storyIdeaUsers("create");

beforeEach(() => clearRateLimits());
afterEach(() => deleteUsers([author]));

test("POST /api/story-ideas needs only a title and the idea", async () => {
  const cookie = await registerUser(author);

  const response = await createIdea(cookie);
  assert.equal(response.status, STATUS_CODE.Created);

  const idea = await response.json();
  assert.equal(idea.status, "open");
  assert.equal(idea.language, "german");
  assert.equal(idea.createdByUsername, author);
  assert.deepEqual(idea.genres, []);
});

test("POST /api/story-ideas takes the same vocabulary a group does", async () => {
  const cookie = await registerUser(author);

  const response = await createIdea(cookie, {
    genres: ["fantasy", "mystery"],
    language: "english",
  });

  const idea = await response.json();
  // One rule for both tables, which is why the enums are shared: an idea's metadata can become
  // the group's untouched.
  assert.deepEqual(idea.genres, ["fantasy", "mystery"]);
  assert.equal(idea.language, "english");
});

test("POST /api/story-ideas refuses a repeat, exactly as a group does", async () => {
  const cookie = await registerUser(author);

  const response = await createIdea(cookie, {
    genres: ["fantasy", "fantasy"],
  });

  assert.equal(response.status, STATUS_CODE.BadRequest);
});

test("POST /api/story-ideas refuses an empty title", async () => {
  const cookie = await registerUser(author);

  // min(1) counts characters before the service trims, the same contract a group title has —
  // so "  " passes validation here and in groups alike; only the truly empty string is refused.
  const response = await createIdea(cookie, { title: "" });
  assert.equal(response.status, STATUS_CODE.BadRequest);
});

/**
 * The same rule the group carries, tested here too: the guard lives in both services and only
 * one of them was pinned — neutering the idea's changed nothing that the suite noticed.
 */
test("POST /api/story-ideas refuses a subgenre from a genre it does not carry", async () => {
  const cookie = await registerUser(author);

  const response = await createIdea(cookie, {
    genres: ["romance"],
    subgenres: ["space_opera"],
  });

  assert.equal(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assert.deepEqual(
    body.issues.map((issue: { path: string }) => issue.path),
    ["subgenres"],
  );
});

test("POST /api/story-ideas refuses a title of only whitespace", async () => {
  const cookie = await registerUser(author);

  // The service trims what it stores, so this used to publish an idea with no title.
  const response = await createIdea(cookie, { title: "   " });

  assert.equal(response.status, STATUS_CODE.BadRequest);
});
