import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_PAGE_SUMMARY_RESPONSE } from "#/src/http/response_schema.ts";
import { FORUM_TAG } from "#/src/open_api_specification.ts";
import { STATUS_CODE } from "#/src/http/status.ts";
import authenticated from "#/src/middleware/authenticated.ts";
import { ForumService } from "#/src/service/forum_service.ts";
import {
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "#/src/http/response.ts";

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [FORUM_TAG],
    summary: "List the forum's pages",
    description:
      "Every page of the public forum the member may see — announcements, FAQs, rules — most recently written in first, without their prose.",
    operationId: "listForumPages",
    middleware: authenticated,
    responses: {
      [STATUS_CODE.OK]: {
        description: "The forum's pages",
        content: jsonContent(z.object({ results: z.array(FORUM_PAGE_SUMMARY_RESPONSE) })),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const results = await ForumService.listPages(c.get("user"));
    return c.json({ results }, STATUS_CODE.OK);
  },
);
