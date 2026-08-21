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
const { author, bystander } = storyIdeaUsers("delete");

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([author, bystander]));

Deno.test("DELETE /api/story-ideas/{id} removes one's own idea", async () => {
  const cookie = await registerUser(author);
  const idea = await (await createIdea(cookie)).json();

  const response = await request(
    "DELETE",
    `/api/story-ideas/${idea.id}`,
    cookie,
  );
  assertEquals(response.status, STATUS_CODE.OK);

  const gone = await request("GET", `/api/story-ideas/${idea.id}`, cookie);
  assertEquals(gone.status, STATUS_CODE.NotFound);
});

Deno.test("DELETE /api/story-ideas/{id} refuses somebody else's", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const idea = await (await createIdea(cookie)).json();

  const response = await request(
    "DELETE",
    `/api/story-ideas/${idea.id}`,
    other,
  );
  assertEquals(response.status, STATUS_CODE.Forbidden);

  const still = await request("GET", `/api/story-ideas/${idea.id}`, cookie);
  assertEquals(still.status, STATUS_CODE.OK);
});
