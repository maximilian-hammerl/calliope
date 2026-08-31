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
    genres: ["fantasy", "mystery"],
    subgenres: ["urban_fantasy"],
    tropes: ["slow_burn"],
    contentWarnings: ["grief"],
    storyThemes: "Erinnerung, Schuld",
    storySettings: "Eine Stadt, die nur nachts existiert",
    tense: "past",
    perspective: "third_person_limited",
  });

  assertEquals(response.status, STATUS_CODE.Created);
  const group = await response.json();
  assertEquals(group.subtitle, "Was du vergisst");
  assertEquals(group.storyStatus, "writing");
  assertEquals(group.genres, ["fantasy", "mystery"]);
  assertEquals(group.contentWarnings, ["grief"]);
  assertEquals(group.perspective, "third_person_limited");
  // Free text, so it comes back as written rather than as a chosen value.
  assertEquals(group.storyThemes, "Erinnerung, Schuld");
  assertEquals(group.storySettings, "Eine Stadt, die nur nachts existiert");
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

Deno.test("POST /api/groups refuses a value it is given twice", async () => {
  const cookie = await registerUser(username);

  const response = await request("POST", "/api/groups", cookie, {
    title: "Doppelt",
    synopsis: "d",
    genres: ["fantasy", "fantasy", "mystery"],
  });

  // Refused rather than de-duplicated: the values are closed, so a repeat is a client bug, and
  // quietly fixing it would answer 200 to a request the sender got wrong.
  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  // The second one is named, by value and by position.
  assertEquals(body.issues.map((issue: { path: string }) => issue.path), [
    "genres.1",
  ]);
  assertEquals(
    body.issues.map((issue: { message: string }) => issue.message),
    ["Duplicate value: fantasy"],
  );
});

Deno.test("POST /api/groups refuses a genre that is not one", async () => {
  const cookie = await registerUser(username);

  const response = await request("POST", "/api/groups", cookie, {
    title: "Erfunden",
    synopsis: "d",
    // What the free-text column used to accept, and what made a filter over it impossible.
    genres: ["Fantasy"],
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assertEquals(body.issues.map((issue: { path: string }) => issue.path), [
    "genres.0",
  ]);
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

/**
 * A subgenre belongs to exactly one genre, and the board only ever offers the subgenres of a
 * genre already picked — so a group carrying one it did not pick could never be found by the
 * filter that offers it: seeing that chip means having picked the genre this group lacks.
 */
Deno.test("POST /api/groups refuses a subgenre from a genre it does not carry", async () => {
  const cookie = await registerUser(username);

  const response = await request("POST", "/api/groups", cookie, {
    title: "Weltraumromanze",
    synopsis: "d",
    genres: ["romance"],
    subgenres: ["space_opera"],
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  // The same shape a failed schema gives, though this rule is enforced below the schema: one kind
  // of 400 for a client to read, naming the field and the value.
  const body = await response.json();
  assertEquals(body.error, "Invalid request");
  assertEquals(body.issues, [
    {
      path: "subgenres",
      message:
        "space_opera belongs to science_fiction, which is not among the genres",
    },
  ]);
});

Deno.test("POST /api/groups takes a subgenre of a genre it does carry", async () => {
  const cookie = await registerUser(username);

  const response = await request("POST", "/api/groups", cookie, {
    title: "Weltraumoper",
    synopsis: "d",
    genres: ["science_fiction", "romance"],
    subgenres: ["space_opera", "contemporary_romance"],
  });

  assertEquals(response.status, STATUS_CODE.Created);
});

Deno.test("POST /api/groups refuses a title of only whitespace", async () => {
  const cookie = await registerUser(username);

  // Not merely stored blank: the service trims, so this used to found a group with no title.
  const response = await request("POST", "/api/groups", cookie, {
    title: "   ",
    synopsis: "d",
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
});
