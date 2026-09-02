import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { PAGE_RESPONSE } from "@/src/http/response_schema.ts";
import { PAGES_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
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
      "The page with its prose. Its `updatedAt` is what an edit has to be sent back with.",
    operationId: "getPage",
    middleware: authenticated,
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
    const { groupId, pageId } = c.req.valid("param");

    const group = await WritingGroupService.selectVisibleWritingGroup(
      c.get("user"),
      groupId,
    );
    if (group === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const page = await WritingPageService.selectPage(groupId, pageId);
    if (page === undefined) {
      return c.json({ error: "Page not found" }, STATUS_CODE.NotFound);
    }

    return c.json(page, STATUS_CODE.OK);
  },
);
