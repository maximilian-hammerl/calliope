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

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [FORUM_TAG],
    summary: "List the forum's threads",
    description:
      "Every thread of the public forum the member may see, most recently written in first. The tree nests them by `folderId`; a thread at the root has none.",
    operationId: "listForumThreads",
    middleware: authenticated,
    responses: {
      [STATUS_CODE.OK]: {
        description: "The forum's threads",
        content: jsonContent(
          z.object({ results: z.array(FORUM_THREAD_RESPONSE) }),
        ),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const results = await ForumService.listThreads(c.get("user"));
    return c.json({ results }, STATUS_CODE.OK);
  },
);
