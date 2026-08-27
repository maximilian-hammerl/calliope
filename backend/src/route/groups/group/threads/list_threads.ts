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
import { WRITING_GROUP_SCHEMA } from "@/src/database/schema.ts";

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

/**
 * Not a page: the strip these fill is the only way between threads, so one missing is one
 * nobody can reach, and the open thread has to be among them or its own tab disappears.
 */
const THREADS_RESPONSE = z.object({ results: z.array(THREAD_RESPONSE) });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [THREADS_TAG],
    summary: "List the threads of a group the current user belongs to",
    description:
      "Every thread of the group, most recently written in first. Not paged: the tab strip these fill is the only way between threads.",
    operationId: "listThreads",
    middleware: authenticated,
    request: { params: GROUP_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "Every thread of the group",
        content: jsonContent(THREADS_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group, or the user is not a member of it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId } = c.req.valid("param");

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

    const results = await WritingThreadService.selectThreads(
      groupId,
      c.get("user").id,
    );

    return c.json({ results }, STATUS_CODE.OK);
  },
);
