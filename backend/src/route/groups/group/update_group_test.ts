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
    blurb: "d",
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
  assertEquals(updated.blurb, created.blurb);
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
    genres: ["Krimi"],
    tense: "Gegenwart",
  });

  assertEquals(response.status, STATUS_CODE.OK);
  const updated = await response.json();
  assertEquals(updated.subtitle, "Ein Untertitel");
  assertEquals(updated.storyStatus, "finished");
  assertEquals(updated.genres, ["Krimi"]);
  assertEquals(updated.tense, "Gegenwart");
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

  await request("PATCH", `/api/groups/${id}`, cookie, { genres: ["Fantasy"] });
  const response = await request("PATCH", `/api/groups/${id}`, cookie, {
    title: "Neuer Titel",
  });

  assertEquals(response.status, STATUS_CODE.OK);
  const updated = await response.json();
  assertEquals(updated.title, "Neuer Titel");
  assertEquals(updated.genres, ["Fantasy"]);
});
