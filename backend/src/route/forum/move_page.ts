import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_PAGE_SUMMARY_RESPONSE } from "@/src/http/response_schema.ts";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";
import { FORUM_ROOT_PERMISSION } from "@/src/service/forum_permission.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import {
  WRITING_FOLDER_SCHEMA,
  WRITING_PAGE_SCHEMA,
} from "@/src/database/schema.ts";

const PAGE_PARAMS = z.object({ pageId: WRITING_PAGE_SCHEMA.shape.id });

const MOVE_PAGE_BODY = z.object({
  folderId: WRITING_FOLDER_SCHEMA.shape.id.nullable(),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Move a page of the forum into another folder",
    description:
      "Whoever may write the page, and only into a folder they may write in. A page is written together rather than owned, so this asks the page's permission rather than who wrote it.",
    operationId: "moveForumPage",
    middleware: authenticated,
    request: {
      params: PAGE_PARAMS,
      body: { required: true, content: jsonContent(MOVE_PAGE_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The page",
        content: jsonContent(FORUM_PAGE_SUMMARY_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such page or folder, or the member may not see it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { pageId } = c.req.valid("param");
    const { folderId } = c.req.valid("json");
    const user = c.get("user");

    const page = await ForumService.selectPageForReader(user, pageId);
    if (page === undefined) {
      return c.json({ error: "Page not found" }, STATUS_CODE.NotFound);
    }

    if (!mayActInForum(user, page.effectiveMemberPermission, "page:move")) {
      return c.json(
        { error: "You cannot move this page" },
        STATUS_CODE.Forbidden,
      );
    }

    let destination = FORUM_ROOT_PERMISSION;
    if (folderId !== null) {
      const folder = await ForumService.selectFolder(user, folderId);
      if (folder === undefined) {
        return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
      }
      destination = folder.effectiveMemberPermission;
    }

    // The same permission adding a page there needs, because that is the same act.
    if (!mayActInForum(user, destination, "page:create")) {
      return c.json(
        { error: "You cannot put a page there" },
        STATUS_CODE.Forbidden,
      );
    }

    const moved = await ForumService.movePage(user, pageId, folderId);
    if (moved === undefined) {
      return c.json({ error: "Page not found" }, STATUS_CODE.NotFound);
    }

    return c.json(moved, STATUS_CODE.OK);
  },
);
