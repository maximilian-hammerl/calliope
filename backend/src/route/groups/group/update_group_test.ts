import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http/status";
import {
  clearRateLimits,
  deleteUsers,
  registerUser,
  request,
} from "@/src/test/support.ts";

const owner = "update-group-owner";
const outsider = "update-group-outsider";

Deno.test.beforeEach(clearRateLimits);
Deno.test.afterEach(() => deleteUsers([owner, outsider]));

function createGroup(cookie: string, visibility: "public" | "private") {
  return request("POST", "/api/groups", cookie, {
    title: "Vorher",
    synopsis: "d",
    visibility,
  }).then((response) => response.json());
}

Deno.test("PATCH /api/groups/{groupId} updates a group the user administers", async () => {
  const cookie = await registerUser(owner);
  const created = await createGroup(cookie, "private");

  const response = await request("PATCH", `/api/groups/${created.id}`, cookie, {
    title: "Nachher",
    visibility: "public",
  });

  assertEquals(response.status, STATUS_CODE.OK);
  const updated = await response.json();
  assertEquals(updated.title, "Nachher");
  assertEquals(updated.visibility, "public");
  // Untouched fields keep their values.
  assertEquals(updated.synopsis, created.synopsis);
});

Deno.test("PATCH /api/groups/{groupId} refuses a non-administrator of a public group", async () => {
  const ownerCookie = await registerUser(owner);
  const created = await createGroup(ownerCookie, "public");

  const outsiderCookie = await registerUser(outsider);
  const response = await request(
    "PATCH",
    `/api/groups/${created.id}`,
    outsiderCookie,
    { title: "Übernommen" },
  );

  // 403 rather than 404: the group is public, so its existence is not a secret.
  assertEquals(response.status, STATUS_CODE.Forbidden);
  assertEquals(await response.json(), {
    error: "Only administrators can update a group",
  });
});

Deno.test("PATCH /api/groups/{groupId} changes the story metadata", async () => {
  const cookie = await registerUser(owner);
  const { id } = await createGroup(cookie, "private");

  const response = await request("PATCH", `/api/groups/${id}`, cookie, {
    subtitle: "Ein Untertitel",
    storyStatus: "finished",
    genres: ["crime"],
    tense: "present",
  });

  assertEquals(response.status, STATUS_CODE.OK);
  const updated = await response.json();
  assertEquals(updated.subtitle, "Ein Untertitel");
  assertEquals(updated.storyStatus, "finished");
  assertEquals(updated.genres, ["crime"]);
  assertEquals(updated.tense, "present");
});

Deno.test("PATCH /api/groups/{groupId} clears an optional field with null", async () => {
  const cookie = await registerUser(owner);
  const { id } = await createGroup(cookie, "private");

  await request("PATCH", `/api/groups/${id}`, cookie, { subtitle: "Da" });
  const response = await request("PATCH", `/api/groups/${id}`, cookie, {
    subtitle: null,
  });

  // Absent means unchanged, null means cleared — a typo in a subtitle has to be removable.
  assertEquals(response.status, STATUS_CODE.OK);
  assertEquals((await response.json()).subtitle, null);
});

Deno.test("PATCH /api/groups/{groupId} leaves untouched fields alone", async () => {
  const cookie = await registerUser(owner);
  const { id } = await createGroup(cookie, "private");

  await request("PATCH", `/api/groups/${id}`, cookie, { genres: ["fantasy"] });
  const response = await request("PATCH", `/api/groups/${id}`, cookie, {
    title: "Neuer Titel",
  });

  assertEquals(response.status, STATUS_CODE.OK);
  const updated = await response.json();
  assertEquals(updated.title, "Neuer Titel");
  assertEquals(updated.genres, ["fantasy"]);
});

/**
 * Checked against the row the update produces rather than against the request: changing only the
 * genres would otherwise leave whatever subgenres are stored sitting under none of them.
 */
Deno.test("PATCH /api/groups/{groupId} refuses genres that orphan the stored subgenres", async () => {
  const cookie = await registerUser(owner);
  const { id } = await createGroup(cookie, "private");

  const set = await request("PATCH", `/api/groups/${id}`, cookie, {
    genres: ["fantasy"],
    subgenres: ["dark_fantasy"],
  });
  assertEquals(set.status, STATUS_CODE.OK);

  // The subgenre is not in this request at all; it is already on the row.
  const response = await request("PATCH", `/api/groups/${id}`, cookie, {
    genres: ["western"],
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);

  // And the group is untouched, so nothing was half-written.
  const after = await (await request("PATCH", `/api/groups/${id}`, cookie, {
    subtitle: "unverändert",
  })).json();
  assertEquals(after.genres, ["fantasy"]);
  assertEquals(after.subgenres, ["dark_fantasy"]);
});

Deno.test("PATCH /api/groups/{groupId} takes genres and subgenres that agree", async () => {
  const cookie = await registerUser(owner);
  const { id } = await createGroup(cookie, "private");

  const response = await request("PATCH", `/api/groups/${id}`, cookie, {
    genres: ["western"],
    subgenres: ["weird_western"],
  });

  assertEquals(response.status, STATUS_CODE.OK);
});

/**
 * An edit normalises what it stores, exactly as founding does. `toRow` says it is "the one place
 * values become a row" — and for a while the update did not go through it, so a padded title and
 * a whitespace-only subtitle survived a PATCH and the group page drew an empty row for the latter.
 */
Deno.test("PATCH /api/groups/{groupId} trims and empties what it stores", async () => {
  const cookie = await registerUser(owner);
  const { id } = await createGroup(cookie, "private");

  const response = await request("PATCH", `/api/groups/${id}`, cookie, {
    title: "  Nach dem Rand  ",
    subtitle: "   ",
    storyThemes: "   ",
  });

  assertEquals(response.status, STATUS_CODE.OK);
  const updated = await response.json();
  assertEquals(updated.title, "Nach dem Rand");
  // Whitespace is nothing written, and nothing written is null — a blank string is truthy and
  // would render as a row with no value in it.
  assertEquals(updated.subtitle, null);
  assertEquals(updated.storyThemes, null);
});

/**
 * `min(1)` counts characters, so „   " passed it and the service's own trim then stored an empty
 * string: one edit could leave a group with no title at all. The browser never sends it — its
 * `titleSchema` trims before checking — which is exactly why the API had to be asked directly.
 */
Deno.test("PATCH /api/groups/{groupId} refuses a title of only whitespace", async () => {
  const cookie = await registerUser(owner);
  const { id } = await createGroup(cookie, "private");

  const response = await request("PATCH", `/api/groups/${id}`, cookie, {
    title: "   ",
  });

  assertEquals(response.status, STATUS_CODE.BadRequest);
  const body = await response.json();
  assertEquals(body.issues.map((issue: { path: string }) => issue.path), [
    "title",
  ]);
});
