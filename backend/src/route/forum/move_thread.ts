import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_THREAD_RESPONSE } from "@/src/http/response_schema.ts";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";
import { FORUM_ROOT_PERMISSION } from "@/src/service/forum_permission.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import {
  WRITING_FOLDER_SCHEMA,
  WRITING_THREAD_SCHEMA,
} from "@/src/database/schema.ts";

const THREAD_PARAMS = z.object({ threadId: WRITING_THREAD_SCHEMA.shape.id });

// Null takes it to the forum's root, which only an operator may write to.
const MOVE_THREAD_BODY = z.object({
  folderId: WRITING_FOLDER_SCHEMA.shape.id.nullable(),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Move a thread of the forum into another folder",
    description:
      "Its author or an operator, and only into a folder they may write in — otherwise a member could drop a thread into a room that only reads. Its own permission travels with it; what the folder grants is applied on top.",
    operationId: "moveForumThread",
    middleware: authenticated,
    request: {
      params: THREAD_PARAMS,
      body: { required: true, content: jsonContent(MOVE_THREAD_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The thread",
        content: jsonContent(FORUM_THREAD_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such thread or folder, or the member may not see it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { threadId } = c.req.valid("param");
    const { folderId } = c.req.valid("json");
    const user = c.get("user");

    const thread = await ForumService.selectThread(user, threadId);
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    // Two questions, not one: may they change this thread, and may they put things where it is
    // going. A writing group needs only the first, its folders all granting the same thing.
    if (
      !mayActInForum(user, thread.effectiveMemberPermission, "thread:move", {
        createdBy: thread.createdBy,
        userId: user.id,
      })
    ) {
      return c.json(
        { error: "Only the author or an operator can move a thread" },
        STATUS_CODE.Forbidden,
      );
    }

    let destination = FORUM_ROOT_PERMISSION;
    if (folderId !== null) {
      const folder = await ForumService.selectFolder(user, folderId);
      if (folder === undefined) {
        return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
      }
      destination = folder.effectiveMemberPermission;
    }

    // The same permission starting a thread there needs, because that is the same act.
    if (!mayActInForum(user, destination, "thread:create")) {
      return c.json(
        { error: "You cannot put a thread there" },
        STATUS_CODE.Forbidden,
      );
    }

    const moved = await ForumService.moveThread(user, threadId, folderId);
    if (moved === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    return c.json(moved, STATUS_CODE.OK);
  },
);
