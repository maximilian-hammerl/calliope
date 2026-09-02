import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { PAGES_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingPageService } from "@/src/service/writing_page_service.ts";
import { mayModify } from "@/src/service/writing_group_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
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
    method: "delete",
    path: "/",
    tags: [PAGES_TAG],
    summary: "Delete a page the current user wrote or administers",
    operationId: "deletePage",
    middleware: authenticated,
    request: { params: PAGE_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The page was deleted",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only the author or an administrator may delete it",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group or page, or the group is not the user's",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId, pageId } = c.req.valid("param");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const page = await WritingPageService.selectPage(groupId, pageId);
    if (page === undefined) {
      return c.json({ error: "Page not found" }, STATUS_CODE.NotFound);
    }

    if (!mayModify(role, page.createdBy, user.id)) {
      return c.json(
        { error: "Only the author or an administrator may delete it" },
        STATUS_CODE.Forbidden,
      );
    }

    await WritingPageService.deletePage(groupId, pageId);
    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
