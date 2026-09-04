import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_FOLDER_RESPONSE } from "@/src/http/response_schema.ts";
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

// Flat, with `parentFolderId` and `depth` on each, exactly as a group's folders are sent: the
// client nests them alongside the threads and pages it already has.
export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [FORUM_TAG],
    summary: "List the forum's folders",
    description:
      "Every folder of the public forum in creation order, flat. A folder the member may not see is absent rather than refused, and an operator sees all of them.",
    operationId: "listForumFolders",
    middleware: authenticated,
    responses: {
      [STATUS_CODE.OK]: {
        description: "The forum's folders",
        content: jsonContent(
          z.object({ results: z.array(FORUM_FOLDER_RESPONSE) }),
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
    const results = await ForumService.listFolders(c.get("user"));
    return c.json({ results }, STATUS_CODE.OK);
  },
);
