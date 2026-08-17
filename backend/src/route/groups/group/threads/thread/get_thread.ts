import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { THREADS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { ThreadService } from "@/src/service/thread_service.ts";
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

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [THREADS_TAG],
    summary: "Fetch a thread of a group the current user belongs to",
    description:
      "Returns a single thread of the group. A thread id belonging to another group is reported as missing.",
    operationId: "getThread",
    middleware: requireSession,
    request: { params: THREAD_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The thread",
        content: jsonContent(THREAD_SCHEMA),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
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

    const role = await WritingGroupService.selectRoleForUser(
      c.get("user"),
      groupId,
    );
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const thread = await ThreadService.selectThread(groupId, threadId);
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    return c.json(thread, STATUS_CODE.OK);
  },
);
