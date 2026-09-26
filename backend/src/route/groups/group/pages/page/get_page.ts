import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { PAGE_RESPONSE } from "@/src/http/response_schema.ts";
import { PAGES_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { VISIBLE_GROUP_PAGE } from "@/src/scope/chains.ts";
import { WritingPageService } from "@/src/service/writing_page_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import {
  WRITING_GROUP_SCHEMA,
  WRITING_PAGE_SCHEMA,
} from "@/src/database/schema.ts";

const PAGE_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  pageId: WRITING_PAGE_SCHEMA.shape.id,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [PAGES_TAG],
    summary: "Read a page",
    description:
      "The page with its prose. Its `lastActivityAt` is what an edit has to be sent back with.",
    operationId: "getPage",
    middleware: VISIBLE_GROUP_PAGE,
    request: { params: PAGE_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The page",
        content: jsonContent(PAGE_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group or page, or the group is not the user's",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const page = await WritingPageService.selectPageForReader(
      c.get("group").id,
      c.get("page").id,
      c.get("user").id,
    );
    if (page === undefined) {
      return c.json({ error: "Page not found" }, STATUS_CODE.NotFound);
    }

    return c.json(page, STATUS_CODE.OK);
  },
);
