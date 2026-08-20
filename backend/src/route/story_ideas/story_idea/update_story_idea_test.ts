import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
} from "@/src/test/support.ts";
import {
  author,
  bystander,
  createIdea,
  patchIdea,
} from "@/src/test/story_ideas.ts";

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([author, bystander]));

Deno.test("PATCH /api/story-ideas/{id} moves the status without touching the rest", async () => {
  const cookie = await registerUser(author);
  const idea = await (await createIdea(cookie, { genres: ["Fantasy"] })).json();

  const response = await patchIdea(cookie, idea.id, { status: "closed" });
  assertEquals(response.status, STATUS_CODE.OK);

  const updated = await response.json();
  assertEquals(updated.status, "closed");
  // Absent means unchanged — the defaulted-PATCH trap the group update once had.
  assertEquals(updated.genres, ["Fantasy"]);
  assertEquals(updated.language, "german");
});

Deno.test("PATCH /api/story-ideas/{id} is the author's alone", async () => {
  const cookie = await registerUser(author);
  const other = await registerUser(bystander);
  const idea = await (await createIdea(cookie)).json();

  const response = await patchIdea(other, idea.id, { status: "closed" });

  // Everyone may read every idea, so 403 is honest here where a private group answers 404.
  assertEquals(response.status, STATUS_CODE.Forbidden);
});

Deno.test("PATCH /api/story-ideas/{id} answers 404 for an id nobody has", async () => {
  const cookie = await registerUser(author);

  const response = await patchIdea(
    cookie,
    "01a00000-0000-7000-8000-00000000ffff",
    { status: "closed" },
  );

  assertEquals(response.status, STATUS_CODE.NotFound);
});
