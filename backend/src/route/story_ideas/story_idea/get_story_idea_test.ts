import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";
import { createIdea, storyIdeaUsers } from "@/src/test/story_ideas.ts";

// Its own two accounts, so another file's cleanup cannot delete them.
const { author, bystander } = storyIdeaUsers("get");

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([author, bystander]));

Deno.test("GET /api/story-ideas/{id} is readable by any member", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const idea = await (await createIdea(cookie)).json();

  // The board is the public part of a private platform: visible to every member, not only
  // the author — that is what it is for.
  const response = await request("GET", `/api/story-ideas/${idea.id}`, other);
  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals((await response.json()).createdByUsername, author);
});

Deno.test("GET /api/story-ideas/{id} answers 404 for an id nobody has", async () => {
  const cookie = await registerUser(author);

  const response = await request(
    "GET",
    "/api/story-ideas/01a00000-0000-7000-8000-00000000ffff",
    cookie,
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});
