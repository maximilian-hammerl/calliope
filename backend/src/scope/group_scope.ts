import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "@hono/zod-openapi";
import { STATUS_CODE } from "@std/http/status";
import type { User } from "@/src/service/user_service.ts";
import type { UserInWritingGroupRole } from "@/src/database/schema.ts";
import {
  type VisibleWritingGroupGate,
  WritingGroupService,
} from "@/src/service/writing_group_service.ts";
import {
  type ThreadGate,
  WritingThreadService,
} from "@/src/service/writing_thread_service.ts";
import {
  type Post,
  WritingPostService,
} from "@/src/service/writing_post_service.ts";
import {
  type PageGate,
  WritingPageService,
} from "@/src/service/writing_page_service.ts";
import {
  type Folder,
  WritingFolderService,
} from "@/src/service/writing_folder_service.ts";
import {
  type NextStep,
  WritingGroupNextStepService,
} from "@/src/service/writing_group_next_step_service.ts";
import {
  type UserInWritingGroup,
  UserInWritingGroupService,
} from "@/src/service/user_in_writing_group_service.ts";
import { invalidRequest } from "@/src/http/invalid_request.ts";
import {
  type FolderId,
  type GroupId,
  type MemberId,
  mint,
  type PageId,
  type PostId,
  type Resolved,
  resolved,
  type StepId,
  type ThreadId,
} from "@/src/scope/scoped_id.ts";

/**
 * Resolvers for the ids in a path, one per level, which a route takes as a chain from
 * `chains.ts`. Each finds its row under the one resolved before it and answers 404 when it is not
 * there or not visible, so a child is only ever reached through its own parent. What the member
 * may *do* stays with the handler.
 *
 * They run before the route's validators, so a malformed id is refused here, in the validators'
 * shape, rather than reaching the database.
 */

const ID = z.uuidv7();

/** The path segment as an id, or the 400 the validator would have given. */
export function pathId(c: Context, name: string): string | Response {
  const raw = c.req.param(name);
  if (raw === undefined) {
    throw new Error(
      `No :${name} in ${c.req.routePath}: the resolver is mounted wrong`,
    );
  }
  return ID.safeParse(raw).success
    ? raw
    : invalidRequest(c, [{ path: name, message: "Invalid UUID" }]);
}

/** What an earlier middleware set. Missing means the route lists them in the wrong order. */
export function earlier<T>(value: T | undefined, name: string): T {
  if (value === undefined) {
    throw new Error(
      `"${name}" is not resolved yet: check the route's middleware order`,
    );
  }
  return value;
}

/** A group the member may see — a public one, or one they belong to. */
export type VisibleGroup =
  & Resolved<Omit<VisibleWritingGroupGate, "role">, GroupId>
  & {
    /** Only a joined member's: an invitation grants nothing yet. */
    role: UserInWritingGroupRole | undefined;
  };

/** A group the member has joined, as every write asks for. */
export type JoinedGroup = { id: GroupId; role: UserInWritingGroupRole };

export type GroupThread = Resolved<ThreadGate, ThreadId>;

export type ThreadPost = Resolved<Post, PostId>;

export type GroupPage = Resolved<PageGate, PageId>;

export type GroupFolder = Resolved<Folder, FolderId>;

export type GroupStep = Resolved<NextStep, StepId>;

/** A membership, joined or invited; a user id alone scopes nothing, so this carries its own. */
export type GroupMember =
  & Omit<UserInWritingGroup, "userId">
  & { userId: MemberId };

export const visibleGroup = createMiddleware<{
  Variables: { user: User; group: VisibleGroup };
}>(async (c, next) => {
  const id = pathId(c, "groupId");
  if (id instanceof Response) {
    return id;
  }

  const group = await WritingGroupService.selectVisibleWritingGroup(
    earlier(c.get("user"), "user"),
    id,
  );
  if (group === undefined) {
    return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
  }

  const { role, ...rest } = group;
  c.set("group", {
    ...resolved<typeof rest, GroupId>(rest),
    role: rest.status === "joined" && role !== null ? role : undefined,
  });
  await next();
  return;
});

export const joinedGroup = createMiddleware<{
  Variables: { user: User; group: JoinedGroup };
}>(async (c, next) => {
  const id = pathId(c, "groupId");
  if (id instanceof Response) {
    return id;
  }

  const role = await WritingGroupService.selectRoleForUser(
    earlier(c.get("user"), "user"),
    id,
  );
  if (role === undefined) {
    return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
  }

  c.set("group", { id: mint<GroupId>(id), role });
  await next();
  return;
});

export const threadInGroup = createMiddleware<{
  Variables: { group: { id: GroupId }; thread: GroupThread };
}>(async (c, next) => {
  const id = pathId(c, "threadId");
  if (id instanceof Response) {
    return id;
  }

  const thread = await WritingThreadService.selectThread(
    earlier(c.get("group"), "group").id,
    id,
  );
  if (thread === undefined) {
    return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
  }

  c.set("thread", resolved<ThreadGate, ThreadId>(thread));
  await next();
  return;
});

/**
 * Under any resolved thread, a group's or the forum's. Another member's draft is reported as
 * missing rather than forbidden.
 */
export const postInThread = createMiddleware<{
  Variables: { user: User; thread: { id: ThreadId }; post: ThreadPost };
}>(async (c, next) => {
  const id = pathId(c, "postId");
  if (id instanceof Response) {
    return id;
  }

  const post = await WritingPostService.selectPost(
    earlier(c.get("thread"), "thread").id,
    id,
    earlier(c.get("user"), "user").id,
  );
  if (post === undefined) {
    return c.json({ error: "Post not found" }, STATUS_CODE.NotFound);
  }

  c.set("post", resolved<Post, PostId>(post));
  await next();
  return;
});

export const pageInGroup = createMiddleware<{
  Variables: { group: { id: GroupId }; page: GroupPage };
}>(async (c, next) => {
  const id = pathId(c, "pageId");
  if (id instanceof Response) {
    return id;
  }

  const page = await WritingPageService.selectPage(
    earlier(c.get("group"), "group").id,
    id,
  );
  if (page === undefined) {
    return c.json({ error: "Page not found" }, STATUS_CODE.NotFound);
  }

  c.set("page", resolved<PageGate, PageId>(page));
  await next();
  return;
});

export const folderInGroup = createMiddleware<{
  Variables: { group: { id: GroupId }; folder: GroupFolder };
}>(async (c, next) => {
  const id = pathId(c, "folderId");
  if (id instanceof Response) {
    return id;
  }

  const folder = await folderOf(earlier(c.get("group"), "group").id, id);
  if (folder === undefined) {
    return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
  }

  c.set("folder", folder);
  await next();
  return;
});

/**
 * A folder id from a request body — where a thread, a page or a folder is to go — resolved
 * against the group as a path's is. The body is validated by then, so the id is well-formed.
 */
export async function folderOf(
  groupId: GroupId,
  folderId: string,
): Promise<GroupFolder | undefined> {
  const folder = await WritingFolderService.selectFolder(groupId, folderId);
  return folder === undefined ? undefined : resolved<Folder, FolderId>(folder);
}

export const stepInGroup = createMiddleware<{
  Variables: { group: { id: GroupId }; step: GroupStep };
}>(async (c, next) => {
  const id = pathId(c, "stepId");
  if (id instanceof Response) {
    return id;
  }

  const step = await WritingGroupNextStepService.selectStep(
    earlier(c.get("group"), "group").id,
    id,
  );
  if (step === undefined) {
    return c.json({ error: "Step not found" }, STATUS_CODE.NotFound);
  }

  c.set("step", resolved<NextStep, StepId>(step));
  await next();
  return;
});

/** The membership named by `:userId`, joined or only invited. */
export const memberOfGroup = createMiddleware<{
  Variables: { group: { id: GroupId }; member: GroupMember };
}>(async (c, next) => {
  const id = pathId(c, "userId");
  if (id instanceof Response) {
    return id;
  }

  const membership = await UserInWritingGroupService.selectMembership(
    earlier(c.get("group"), "group").id,
    id,
  );
  if (membership === undefined) {
    return c.json({ error: "Membership not found" }, STATUS_CODE.NotFound);
  }

  c.set("member", { ...membership, userId: mint<MemberId>(membership.userId) });
  await next();
  return;
});
