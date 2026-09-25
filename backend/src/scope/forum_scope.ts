import { createMiddleware } from "hono/factory";
import { STATUS_CODE } from "@std/http/status";
import type { User } from "@/src/service/user_service.ts";
import {
  type ForumFolder,
  type ForumPage,
  ForumService,
  type ForumThread,
} from "@/src/service/forum_service.ts";
import { earlier, pathId } from "@/src/scope/group_scope.ts";
import {
  type FolderId,
  type PageId,
  type Resolved,
  resolved,
  type ThreadId,
} from "@/src/scope/scoped_id.ts";

/** The forum's resolvers, as `group_scope.ts` describes them. Its posts use `postInThread`. */

export type ScopedForumThread = Resolved<ForumThread, ThreadId>;

export type ScopedForumFolder = Resolved<ForumFolder, FolderId>;

export type ScopedForumPage = Resolved<ForumPage, PageId>;

/** A thread of the forum, not a group's, that the member may see. */
export const forumThread = createMiddleware<{
  Variables: { user: User; thread: ScopedForumThread };
}>(async (c, next) => {
  const id = pathId(c, "threadId");
  if (id instanceof Response) {
    return id;
  }

  const thread = await ForumService.selectThread(
    earlier(c.get("user"), "user"),
    id,
  );
  if (thread === undefined) {
    return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
  }

  c.set("thread", resolved<ForumThread, ThreadId>(thread));
  await next();
  return;
});

/** A folder of the forum the member may see; an operator sees every one. */
export const forumFolder = createMiddleware<{
  Variables: { user: User; folder: ScopedForumFolder };
}>(async (c, next) => {
  const id = pathId(c, "folderId");
  if (id instanceof Response) {
    return id;
  }

  const folder = await forumFolderOf(earlier(c.get("user"), "user"), id);
  if (folder === undefined) {
    return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
  }

  c.set("folder", folder);
  await next();
  return;
});

/** A folder id from a request body, resolved as a path's is — see `folderOf`. */
export async function forumFolderOf(
  user: User,
  folderId: string,
): Promise<ScopedForumFolder | undefined> {
  const folder = await ForumService.selectFolder(user, folderId);
  return folder === undefined
    ? undefined
    : resolved<ForumFolder, FolderId>(folder);
}

export const forumPage = createMiddleware<{
  Variables: { user: User; page: ScopedForumPage };
}>(async (c, next) => {
  const id = pathId(c, "pageId");
  if (id instanceof Response) {
    return id;
  }

  const page = await ForumService.selectPageForReader(
    earlier(c.get("user"), "user"),
    id,
  );
  if (page === undefined) {
    return c.json({ error: "Page not found" }, STATUS_CODE.NotFound);
  }

  c.set("page", resolved<ForumPage, PageId>(page));
  await next();
  return;
});
