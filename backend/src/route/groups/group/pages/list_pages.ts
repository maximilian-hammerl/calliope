import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { PAGE_SUMMARY_RESPONSE } from "@/src/http/response_schema.ts";
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
import { WRITING_GROUP_SCHEMA } from "@/src/database/schema.ts";

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

// GET rather than QUERY, as with steps: the whole set for one group, and titles only.
export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [PAGES_TAG],
    summary: "List a group's pages",
    description:
      "Titles in the order they were made, without their prose. Readable by whoever may see the group, which for a public group includes non-members.",
    operationId: "listPages",
    middleware: authenticated,
    request: { params: GROUP_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The group's pages",
        content: jsonContent(
          z.object({ results: z.array(PAGE_SUMMARY_RESPONSE) }),
        ),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group, or it is private and not the user's",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId } = c.req.valid("param");

    const group = await WritingGroupService.selectVisibleWritingGroup(
      c.get("user"),
      groupId,
    );
    if (group === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const results = await WritingPageService.listPages(
      groupId,
      c.get("user").id,
    );
    return c.json({ results }, STATUS_CODE.OK);
  },
);
