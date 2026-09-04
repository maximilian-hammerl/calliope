import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_THREAD_RESPONSE } from "@/src/http/response_schema.ts";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { WRITING_THREAD_SCHEMA } from "@/src/database/schema.ts";

const THREAD_PARAMS = z.object({ threadId: WRITING_THREAD_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Get one thread of the forum",
    description:
      "The thread itself, without its posts. Hidden answers 404 rather than 403, so a member cannot tell a thread they may not see from one that does not exist.",
    operationId: "getForumThread",
    middleware: authenticated,
    request: { params: THREAD_PARAMS },
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
        description: "No such thread, or the member may not see it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { threadId } = c.req.valid("param");

    const thread = await ForumService.selectThread(c.get("user"), threadId);
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    return c.json(thread, STATUS_CODE.OK);
  },
);
