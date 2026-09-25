import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { db } from "@/src/database/client.ts";
import { notBlank } from "@/src/http/request_schema.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { THREAD_RESPONSE } from "@/src/http/response_schema.ts";
import { THREADS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { folderOf, joinedGroup } from "@/src/scope/group_scope.ts";
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

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

const CREATE_THREAD_BODY = WRITING_THREAD_SCHEMA
  .pick({ title: true })
  .extend({
    title: notBlank(
      WRITING_THREAD_SCHEMA.shape.title.min(1).max(TEXT_LIMIT.threadTitle),
    ),
    // Absent puts it at the root of the group's tree. Moving it later is its own operation.
    folderId: WRITING_THREAD_SCHEMA.shape.folderId.optional(),
  });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [THREADS_TAG],
    summary: "Start a thread in a group the current user writes in",
    description:
      "Starts a thread in the group. Writers and administrators may start threads; readers may not.",
    operationId: "createThread",
    middleware: [authenticated, joinedGroup] as const,
    request: {
      params: GROUP_PARAMS,
      body: { required: true, content: jsonContent(CREATE_THREAD_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The thread was created",
        content: jsonContent(THREAD_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Readers cannot start threads",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group, or the user is not a member of it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  // Content is members-only, so `joinedGroup` tells a non-member nothing about the group.
  async (c) => {
    const { title, folderId } = c.req.valid("json");
    const user = c.get("user");
    const group = c.get("group");

    if (!mayAct(group.role, "thread:create")) {
      return c.json(
        { error: "Only writers and administrators can start a thread" },
        STATUS_CODE.Forbidden,
      );
    }

    const folder = folderId === undefined || folderId === null
      ? null
      : await folderOf(group.id, folderId);
    if (folder === undefined) {
      return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
    }

    const thread = await db.transaction().execute((transaction) =>
      WritingThreadService.insertThread(
        transaction,
        group.id,
        title,
        user.id,
        folder?.id ?? null,
      )
    );

    return c.json(thread, STATUS_CODE.Created);
  },
);
