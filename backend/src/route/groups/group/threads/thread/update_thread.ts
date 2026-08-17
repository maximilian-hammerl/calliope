import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { THREADS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { ThreadService } from "@/src/service/thread_service.ts";
import { mayModify } from "@/src/service/writing_group_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/response.ts";
import { THREAD_SCHEMA, WRITING_GROUP_SCHEMA } from "@/src/database/schema.ts";

const THREAD_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  threadId: THREAD_SCHEMA.shape.id,
});

const UPDATE_THREAD_BODY = THREAD_SCHEMA
  .pick({ title: true })
  .extend({ title: THREAD_SCHEMA.shape.title.min(1) });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: [THREADS_TAG],
    summary: "Rename a thread the current user wrote or administers",
    description:
      "Renames a thread. Only the member who started it, or an administrator of the group, may change it.",
    operationId: "updateThread",
    middleware: requireSession,
    request: {
      params: THREAD_PARAMS,
      body: { required: true, content: jsonContent(UPDATE_THREAD_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The updated thread",
        content: jsonContent(THREAD_SCHEMA),
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

    const thread = await ThreadService.selectThread(groupId, threadId);
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    if (!mayModify(role, thread.createdBy, user.id)) {
      return c.json(
        { error: "Only the author or an administrator can change a thread" },
        STATUS_CODE.Forbidden,
      );
    }

    const updated = await ThreadService.updateThread(threadId, { title });
    if (updated === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    return c.json(updated, STATUS_CODE.OK);
  },
);
