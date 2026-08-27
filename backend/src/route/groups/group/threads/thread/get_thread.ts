import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { THREAD_RESPONSE } from "@/src/http/response_schema.ts";
import { THREADS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingThreadService } from "@/src/service/writing_thread_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
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

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [THREADS_TAG],
    summary: "Fetch a thread of a group the current user belongs to",
    description:
      "Returns a single thread of the group. A thread id belonging to another group is reported as missing.",
    operationId: "getThread",
    middleware: authenticated,
    request: { params: THREAD_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The thread",
        content: jsonContent(THREAD_RESPONSE),
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
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId, threadId } = c.req.valid("param");

    // Whatever the reader may *see* — a public group's writing is readable by the community,
    // which is what makes it public rather than merely listed. Drafts stay with their author
    // through `readableBy`, and writing still needs a role.
    const group = await WritingGroupService.selectVisibleWritingGroup(
      c.get("user"),
      groupId,
    );
    if (group === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const thread = await WritingThreadService.selectThreadForReader(
      groupId,
      threadId,
      c.get("user").id,
    );
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    return c.json(thread, STATUS_CODE.OK);
  },
);
