import { db } from "@/src/database/client.ts";
import {
  createGroup,
  deleteUsers,
  postBody,
  request,
} from "@/src/test/support.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { plainTextToDocument } from "@/src/document/document_text.ts";

/**
 * Three accounts per test file, named by `scope`. The suite runs `--parallel`, so shared names
 * would have each file's `afterEach` deleting accounts the other was still using.
 */
export function favouriteFixture(scope: string) {
  // A long scope pushes the name past TEXT_LIMIT.username, and registration then fails in
  // whichever test happens to run first rather than saying what is wrong.
  if (`favourite-${scope}-outsider`.length > TEXT_LIMIT.username) {
    throw new Error(
      `Scope "${scope}" makes a username longer than ${TEXT_LIMIT.username}`,
    );
  }

  return {
    owner: `favourite-${scope}-owner`,
    member: `favourite-${scope}-member`,
    outsider: `favourite-${scope}-outsider`,
  };
}

export const setFavourite = (
  cookie: string,
  targetType: string,
  targetId: string,
) => request("PUT", `/api/favourites/${targetType}/${targetId}`, cookie);

export const clearFavourite = (
  cookie: string,
  targetType: string,
  targetId: string,
) => request("DELETE", `/api/favourites/${targetType}/${targetId}`, cookie);

/** What the table holds for one member, which is the only place a favourite is visible so far. */
export const favouritesOf = (userId: string) =>
  db
    .selectFrom("favourite")
    .select([
      "writingGroupId",
      "writingThreadId",
      "writingPostId",
      "writingPageId",
      "storyIdeaId",
      "chatGroupId",
    ])
    .where("userId", "=", userId)
    .execute();

/** A public group with a thread, a post and a page in it, so every writing kind is reachable. */
export async function aPublicGroup(cookie: string, title: string) {
  const group = await createGroup(cookie, title, "public");
  const thread = await (await request(
    "POST",
    `/api/groups/${group.id}/threads`,
    cookie,
    { title: "Thread" },
  )).json();
  const post = await (await request(
    "POST",
    `/api/groups/${group.id}/threads/${thread.id}/posts`,
    cookie,
    postBody("Ein Absatz."),
  )).json();
  const page = await (await request(
    "POST",
    `/api/groups/${group.id}/pages`,
    cookie,
    { title: "Seite", document: plainTextToDocument("Ein Ort am Hang.") },
  )).json();
  return { group, thread, post, page };
}

/** Favourites cascade with whatever they name, so only the accounts need removing. */
export const cleanUpFavourites = (usernames: string[]) =>
  deleteUsers(usernames);
