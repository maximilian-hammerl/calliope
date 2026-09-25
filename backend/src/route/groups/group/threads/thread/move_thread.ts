import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { db } from "@/src/database/client.ts";
import { THREAD_RESPONSE } from "@/src/http/response_schema.ts";
import { THREADS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import {
  folderOf,
  joinedGroup,
  threadInGroup,
} from "@/src/scope/group_scope.ts";
import { WritingThreadService } from "@/src/service/writing_thread_service.ts";
import { mayAct } from "@/src/service/writing_group_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import {
  WRITING_GROUP_SCHEMA,
  WRITING_THREAD_SCHEMA,
} from "@/src/database/schema.ts";

const THREAD_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  threadId: WRITING_THREAD_SCHEMA.shape.id,
});

// Null moves it to the root.
const MOVE_THREAD_BODY = z.object({
  folderId: WRITING_THREAD_SCHEMA.shape.folderId,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/",
    tags: [THREADS_TAG],
    summary: "Move a thread into a folder, or to the root",
    description:
      "Does not count as activity in the thread or in its group: moving something is not writing in it, so neither is reordered.",
    operationId: "moveThread",
    middleware: [authenticated, joinedGroup, threadInGroup] as const,
    request: {
      params: THREAD_PARAMS,
      body: { required: true, content: jsonContent(MOVE_THREAD_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The moved thread",
        content: jsonContent(THREAD_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only the creator or an administrator may move it",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group or thread, or no such folder in the group",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { folderId } = c.req.valid("json");
    const user = c.get("user");
    const group = c.get("group");
    const thread = c.get("thread");

    if (
      !mayAct(group.role, "thread:move", {
        createdBy: thread.createdBy,
        userId: user.id,
      })
    ) {
      return c.json(
        { error: "Only the creator or an administrator can move a thread" },
        STATUS_CODE.Forbidden,
      );
    }

    const folder = folderId === null
      ? null
      : await folderOf(group.id, folderId);
    if (folder === undefined) {
      return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
    }

    const moved = await db.transaction().execute((transaction) =>
      WritingThreadService.moveThread(
        transaction,
        group.id,
        thread.id,
        folder?.id ?? null,
        user.id,
      )
    );
    if (moved === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    return c.json(moved, STATUS_CODE.OK);
  },
);
