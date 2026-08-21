import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import { db } from "@/src/database/client.ts";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";

const username = "create-group-test-user";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([username]));

Deno.test("POST /api/groups creates a group and makes the creator its administrator", async () => {
  const cookie = await registerUser(username);

  const response = await request("POST", "/api/groups", cookie, {
    title: "Fantasy-Projekt",
    synopsis: "Ein gemeinsames Projekt",
  });

  assertEquals(response.status, STATUS_CODE.Created);
  const group = await response.json();
  assertEquals(group.title, "Fantasy-Projekt");
  // Private unless the request asks otherwise.
  assertEquals(group.visibility, "private");

  const membership = await db
    .selectFrom("userInWritingGroup")
    .innerJoin("user", "user.id", "userInWritingGroup.userId")
    .select(["userInWritingGroup.role", "user.username"])
    .where("userInWritingGroup.writingGroupId", "=", group.id)
    .execute();

  assertEquals(membership, [{ role: "administrator", username }]);
  assertEquals(
    group.createdBy,
    (await db
      .selectFrom("user")
      .select("id")
      .where("username", "=", username)
      .executeTakeFirstOrThrow()).id,
  );
});

Deno.test("POST /api/groups rejects a body without a title", async () => {
  const cookie = await registerUser(username);

  const response = await request("POST", "/api/groups", cookie, {
    synopsis: "Kein Titel",
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assertEquals(body.error, "Invalid request");
  assertEquals(body.issues.map((issue: { path: string }) => issue.path), [
    "title",
  ]);
});

Deno.test("POST /api/groups stores the story metadata", async () => {
  const cookie = await registerUser(username);

  const response = await request("POST", "/api/groups", cookie, {
    title: "Der Erinnerungsmarkt",
    subtitle: "Was du vergisst",
    synopsis: "d",
    storyStatus: "writing",
    genres: ["Fantasy", "Mystery"],
    subgenres: ["Urban Fantasy"],
    tropes: ["Slow Burn"],
    contentWarnings: ["Gedächtnisverlust"],
    tense: "Vergangenheit",
    perspective: "Dritte Person",
  });

  assertEquals(response.status, STATUS_CODE.Created);
  const group = await response.json();
  assertEquals(group.subtitle, "Was du vergisst");
  assertEquals(group.storyStatus, "writing");
  assertEquals(group.genres, ["Fantasy", "Mystery"]);
  assertEquals(group.contentWarnings, ["Gedächtnisverlust"]);
  assertEquals(group.perspective, "Dritte Person");
});

Deno.test("POST /api/groups defaults the metadata a member did not give", async () => {
  const cookie = await registerUser(username);

  const response = await request("POST", "/api/groups", cookie, {
    title: "Ohne alles",
    synopsis: "d",
  });

  assertEquals(response.status, STATUS_CODE.Created);
  const group = await response.json();
  // Every field optional except the status, which every story has: a new one is being planned.
  assertEquals(group.storyStatus, "planning");
  assertEquals(group.subtitle, null);
  assertEquals(group.tense, null);
  assertEquals(group.genres, []);
  assertEquals(group.tropes, []);
});

Deno.test("POST /api/groups tidies the tags it is given", async () => {
  const cookie = await registerUser(username);

  const response = await request("POST", "/api/groups", cookie, {
    title: "Unordentlich",
    synopsis: "d",
    // Spacing, a repeat in another case, and an entry that is only whitespace.
    genres: ["  Fantasy  ", "fantasy", "   ", "Mystery"],
  });

  assertEquals(response.status, STATUS_CODE.Created);
  // The first spelling wins, because that is the one the member chose to type.
  assertEquals((await response.json()).genres, ["Fantasy", "Mystery"]);
});

Deno.test("POST /api/groups refuses more tags than a rail can show", async () => {
  const cookie = await registerUser(username);

  const response = await request("POST", "/api/groups", cookie, {
    title: "Zu viele",
    synopsis: "d",
    genres: Array.from({ length: 13 }, (_, index) => `Genre ${index}`),
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
});
