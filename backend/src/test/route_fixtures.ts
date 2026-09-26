import { assertEquals } from "@std/assert";
import { db } from "@/src/database/client.ts";
import { plainTextToDocument } from "@/src/document/document_text.ts";
import type { ForumPermission } from "@/src/database/schema.ts";
import { createGroup, postBody, request } from "@/src/test/support.ts";
import {
  createForumFolder,
  createForumPage,
  createForumPost,
  createForumThread,
} from "@/src/test/forum.ts";

/** What `parent_scope_test.ts` and `stranger_access_test.ts` build their rows and requests from. */

export type Ids = Record<string, string>;

/** Posts, and fails with the answer rather than later, as a row that is not there. */
export async function createdOk(
  cookie: string,
  path: string,
  body: unknown,
  status = 201,
) {
  const response = await request("POST", path, cookie, body);
  assertEquals(response.status, status, `POST ${path}`);
  return await response.json();
}

/** A group with one of every child, all at the root so its folder is empty and deletable. */
export async function groupWithChildren(
  cookie: string,
  title: string,
  visibility: "private" | "public" = "private",
): Promise<Ids> {
  const group = await createGroup(cookie, title, visibility);
  const base = `/api/groups/${group.id}`;

  const thread = await createdOk(cookie, `${base}/threads`, {
    title: "Kapitel",
  });
  const post = await createdOk(
    cookie,
    `${base}/threads/${thread.id}/posts`,
    postBody("Text"),
  );
  const page = await createdOk(cookie, `${base}/pages`, {
    title: "Figuren",
    document: plainTextToDocument("Liste"),
  });
  const folder = await createdOk(cookie, `${base}/folders`, { title: "Leer" });
  const step = await createdOk(cookie, `${base}/steps`, { text: "Planen" });

  return {
    groupId: group.id,
    threadId: thread.id,
    postId: post.id,
    pageId: page.id,
    folderId: folder.id,
    stepId: step.id,
  };
}

/** The forum at one permission: a room with a thread and a page, and an empty room beside it. */
export async function forumWithChildren(
  label: string,
  permission: ForumPermission,
  authorId: string,
): Promise<Ids> {
  const room = await createForumFolder(`${label} (Raum)`, permission);
  const thread = await createForumThread(label, permission, room.id);
  const post = await createForumPost(thread.id, "Text", authorId);
  const page = await createForumPage(label, "Liste", permission, room.id);
  const empty = await createForumFolder(`${label} (leer)`, permission);

  return {
    threadId: thread.id,
    postId: post.id,
    pageId: page.id,
    folderId: empty.id,
  };
}

/** Read when the body is made: a page's save is refused once its `lastActivityAt` moved on. */
async function pageLoadedAt(pageId: string | undefined): Promise<string> {
  const page = await db
    .selectFrom("writingPage")
    .select("lastActivityAt")
    .where("id", "=", pageId ?? "")
    .executeTakeFirstOrThrow();
  return page.lastActivityAt;
}

const pageSave = async (ids: Ids) => ({
  title: "Umbenannt",
  document: plainTextToDocument("Neu"),
  loadedAt: await pageLoadedAt(ids.pageId),
});

/**
 * The body each operation with an id in its path needs, from the ids of the rows it addresses.
 * `inviteeId` is whoever an invitation names.
 */
export const REQUEST_BODIES: Record<string, (ids: Ids) => unknown> = {
  "PATCH /api/groups/{groupId}": () => ({ title: "Umbenannt" }),
  "POST /api/groups/{groupId}/folders": () => ({ title: "Neu" }),
  "PUT /api/groups/{groupId}/folders/{folderId}": () => ({
    title: "Umbenannt",
    description: null,
  }),
  "PUT /api/groups/{groupId}/folders/{folderId}/parent": () => ({
    parentFolderId: null,
  }),
  "POST /api/groups/{groupId}/memberships": (ids) => ({
    userId: ids.inviteeId,
    role: "reader",
  }),
  "PATCH /api/groups/{groupId}/memberships/{userId}": () => ({
    role: "reader",
  }),
  "POST /api/groups/{groupId}/pages": () => ({
    title: "Neu",
    document: plainTextToDocument("Text"),
  }),
  "PUT /api/groups/{groupId}/pages/{pageId}": pageSave,
  "PUT /api/groups/{groupId}/pages/{pageId}/folder": () => ({ folderId: null }),
  "POST /api/groups/{groupId}/steps": () => ({ text: "Planen" }),
  "PATCH /api/groups/{groupId}/steps/{stepId}": () => ({ done: true }),
  "POST /api/groups/{groupId}/threads": () => ({ title: "Neu" }),
  "PATCH /api/groups/{groupId}/threads/{threadId}": () => ({
    title: "Umbenannt",
  }),
  "POST /api/groups/{groupId}/threads/{threadId}/posts": () =>
    postBody("Dazwischen"),
  "QUERY /api/groups/{groupId}/threads/{threadId}/posts": () => ({}),
  "PATCH /api/groups/{groupId}/threads/{threadId}/posts/{postId}": () =>
    postBody("Überschrieben"),
  "PUT /api/groups/{groupId}/threads/{threadId}/folder": () => ({
    folderId: null,
  }),
  "PUT /api/forum/folders/{folderId}": () => ({
    title: "Umbenannt",
    description: null,
  }),
  "PUT /api/forum/folders/{folderId}/parent": () => ({ parentFolderId: null }),
  "PUT /api/forum/threads/{threadId}/folder": () => ({ folderId: null }),
  "QUERY /api/forum/threads/{threadId}/posts": () => ({}),
  "POST /api/forum/threads/{threadId}/posts": () => postBody("Dazwischen"),
  "PATCH /api/forum/threads/{threadId}/posts/{postId}": () =>
    postBody("Überschrieben"),
  "PUT /api/forum/pages/{pageId}": pageSave,
  "PUT /api/forum/pages/{pageId}/folder": () => ({ folderId: null }),
  "POST /api/chats/{chatId}/memberships": (ids) => ({ userId: ids.inviteeId }),
  "QUERY /api/chats/{chatId}/memberships": () => ({}),
  "QUERY /api/chats/{chatId}/messages": () => ({}),
  "POST /api/chats/{chatId}/messages": () => ({ text: "Hallo" }),
  "PATCH /api/story-ideas/{ideaId}": () => ({ title: "Umbenannt" }),
  "POST /api/users/{userId}/ban": () => ({ reason: "Grund" }),
  "PATCH /api/reports/{reportId}": () => ({ status: "in_progress" }),
};

/** A name without an id stays in braces, which the route refuses as malformed. */
export function address(path: string, ids: Ids): string {
  return path.replace(/\{(\w+)\}/g, (whole, name) => ids[name] ?? whole);
}

/** A well-formed id that nothing has. */
export function missingId(): string {
  const hex = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  return `01900000-0000-7000-8000-${hex}`;
}

export type Answer = { status: number; error: unknown };

/** A request's status and error, its body read either way; a picture is bytes, not an error. */
export async function answer(
  method: string,
  path: string,
  cookie: string,
  body: unknown,
): Promise<Answer> {
  const response = await request(method, path, cookie, body);
  if (!response.headers.get("content-type")?.includes("application/json")) {
    await response.body?.cancel();
    return { status: response.status, error: undefined };
  }
  return { status: response.status, error: (await response.json())?.error };
}
