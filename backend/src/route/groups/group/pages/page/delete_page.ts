import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { db } from "@/src/database/client.ts";
import { PAGES_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { joinedGroup, pageInGroup } from "@/src/scope/group_scope.ts";
import { WritingPageService } from "@/src/service/writing_page_service.ts";
import { mayAct } from "@/src/service/writing_group_authorization.ts";
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
    summary: "Delete a page",
    operationId: "deletePage",
    middleware: [authenticated, joinedGroup, pageInGroup] as const,
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
        description: "Only writers and administrators can delete a page",
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
    const group = c.get("group");

    if (!mayAct(group.role, "page:delete")) {
      return c.json(
        { error: "Only writers and administrators can delete a page" },
        STATUS_CODE.Forbidden,
      );
    }

    await db.transaction().execute((transaction) =>
      WritingPageService.deletePage(transaction, group.id, c.get("page").id)
    );
    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
