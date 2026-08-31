import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
} from "@/src/test/support.ts";
import {
  createIdea,
  patchIdea,
  storyIdeaUsers,
} from "@/src/test/story_ideas.ts";

// Its own two accounts, so another file's cleanup cannot delete them.
const { author, bystander } = storyIdeaUsers("update");

Deno.test.beforeEach(() => clearRateLimits());
Deno.test.afterEach(() => deleteUsers([author, bystander]));

Deno.test("PATCH /api/story-ideas/{id} moves the status without touching the rest", async () => {
  const cookie = await registerUser(author);
  const idea = await (await createIdea(cookie, { genres: ["fantasy"] })).json();

  const response = await patchIdea(cookie, idea.id, { status: "closed" });
  assertEquals(response.status, STATUS_CODE.OK);

  const updated = await response.json();
  assertEquals(updated.status, "closed");
  // Absent means unchanged — the defaulted-PATCH trap the group update once had.
  assertEquals(updated.genres, ["fantasy"]);
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

/**
 * Against the row the update produces, not against the request: a PATCH that moves only the
 * genres orphans whatever subgenres are already stored. The group's update is tested for this;
 * the idea's was not, and the guard could have been dropped without a single test noticing.
 */
Deno.test("PATCH /api/story-ideas/{ideaId} refuses genres that orphan the stored subgenres", async () => {
  const cookie = await registerUser(author);
  const idea = await (await createIdea(cookie, {
    genres: ["fantasy"],
    subgenres: ["dark_fantasy"],
  })).json();

  // The subgenre is not in this request at all; it is already on the row.
  const response = await patchIdea(cookie, idea.id, { genres: ["western"] });

  assertEquals(response.status, STATUS_CODE.BadRequest);

  // And the idea is untouched, so the transaction rolled back rather than half-writing.
  const after =
    await (await patchIdea(cookie, idea.id, { subtitle: "unverändert" }))
      .json();
  assertEquals(after.genres, ["fantasy"]);
  assertEquals(after.subgenres, ["dark_fantasy"]);
});

Deno.test("PATCH /api/story-ideas/{ideaId} takes genres and subgenres that agree", async () => {
  const cookie = await registerUser(author);
  const idea = await (await createIdea(cookie)).json();

  const response = await patchIdea(cookie, idea.id, {
    genres: ["western"],
    subgenres: ["weird_western"],
  });

  assertEquals(response.status, STATUS_CODE.OK);
});
