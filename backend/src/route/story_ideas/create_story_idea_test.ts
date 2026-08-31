import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
} from "@/src/test/support.ts";
import { createIdea, storyIdeaUsers } from "@/src/test/story_ideas.ts";

// Its own two accounts, so another file's cleanup cannot delete them.
const { author } = storyIdeaUsers("create");

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([author]));

Deno.test("POST /api/story-ideas needs only a title and the idea", async () => {
  const cookie = await registerUser(author);

  const response = await createIdea(cookie);
  assertEquals(response.status, STATUS_CODE.Created);

  const idea = await response.json();
  assertEquals(idea.status, "open");
  assertEquals(idea.language, "german");
  assertEquals(idea.createdByUsername, author);
  assertEquals(idea.genres, []);
});

Deno.test("POST /api/story-ideas takes the same vocabulary a group does", async () => {
  const cookie = await registerUser(author);

  const response = await createIdea(cookie, {
    genres: ["fantasy", "mystery"],
    language: "english",
  });

  const idea = await response.json();
  // One rule for both tables, which is why the enums are shared: an idea's metadata can become
  // the group's untouched.
  assertEquals(idea.genres, ["fantasy", "mystery"]);
  assertEquals(idea.language, "english");
});

Deno.test("POST /api/story-ideas refuses a repeat, exactly as a group does", async () => {
  const cookie = await registerUser(author);

  const response = await createIdea(cookie, {
    genres: ["fantasy", "fantasy"],
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
});

Deno.test("POST /api/story-ideas refuses an empty title", async () => {
  const cookie = await registerUser(author);

  // min(1) counts characters before the service trims, the same contract a group title has —
  // so "  " passes validation here and in groups alike; only the truly empty string is refused.
  const response = await createIdea(cookie, { title: "" });
  assertEquals(response.status, STATUS_CODE.BadRequest);
});
