import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_PAGE_RESPONSE } from "@/src/http/response_schema.ts";
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
import { WRITING_PAGE_SCHEMA } from "@/src/database/schema.ts";

const PAGE_PARAMS = z.object({ pageId: WRITING_PAGE_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Get one page of the forum",
    description:
      "The page and its prose. Hidden answers 404 rather than 403, so a member cannot tell a page they may not see from one that does not exist.",
    operationId: "getForumPage",
    middleware: authenticated,
    request: { params: PAGE_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The page",
        content: jsonContent(FORUM_PAGE_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such page, or the member may not see it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { pageId } = c.req.valid("param");

    const page = await ForumService.selectPageForReader(
      c.get("user"),
      pageId,
    );
    if (page === undefined) {
      return c.json({ error: "Page not found" }, STATUS_CODE.NotFound);
    }

    return c.json(page, STATUS_CODE.OK);
  },
);
