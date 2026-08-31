import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { notBlank } from "@/src/http/request_schema.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { THREAD_RESPONSE } from "@/src/http/response_schema.ts";
import { THREADS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingThreadService } from "@/src/service/writing_thread_service.ts";
import { mayModify } from "@/src/service/writing_group_authorization.ts";
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

const UPDATE_THREAD_BODY = WRITING_THREAD_SCHEMA
  .pick({ title: true })
  .extend({
    title: notBlank(
      WRITING_THREAD_SCHEMA.shape.title.min(1).max(TEXT_LIMIT.threadTitle),
    ),
  });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: [THREADS_TAG],
    summary: "Rename a thread the current user wrote or administers",
    description:
      "Renames a thread. Only the member who started it, or an administrator of the group, may change it.",
    operationId: "updateThread",
    middleware: authenticated,
    request: {
      params: THREAD_PARAMS,
      body: { required: true, content: jsonContent(UPDATE_THREAD_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The updated thread",
        content: jsonContent(THREAD_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only the author or an administrator may change it",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group or thread, or the user is not a member",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId, threadId } = c.req.valid("param");
    const { title } = c.req.valid("json");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const thread = await WritingThreadService.selectThread(groupId, threadId);
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    if (!mayModify(role, thread.createdBy, user.id)) {
      return c.json(
        { error: "Only the author or an administrator can change a thread" },
        STATUS_CODE.Forbidden,
      );
    }

    const updated = await WritingThreadService.updateThread(
      threadId,
      { title },
      c.get("user").id,
    );
    if (updated === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    return c.json(updated, STATUS_CODE.OK);
  },
);
