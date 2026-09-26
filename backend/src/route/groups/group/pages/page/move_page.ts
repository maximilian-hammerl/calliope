import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { db } from "@/src/database/client.ts";
import { PAGE_RESPONSE } from "@/src/http/response_schema.ts";
import { PAGES_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { JOINED_GROUP_PAGE } from "@/src/scope/chains.ts";
import { folderOf } from "@/src/scope/group_scope.ts";
import { WritingPageService } from "@/src/service/writing_page_service.ts";
import { mayAct } from "@/src/service/writing_group_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
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

// Null moves it to the root. Its own operation rather than part of the page's save, which is a
// whole-page write guarded by `lastActivityAt` — a move is neither of those things.
const MOVE_PAGE_BODY = z.object({
  folderId: WRITING_PAGE_SCHEMA.shape.folderId,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/",
    tags: [PAGES_TAG],
    summary: "Move a page into a folder, or to the root",
    description:
      "Does not count as writing in it: the page keeps the activity time it had, so it stays where it was in the order and still reports when it was last edited.",
    operationId: "movePage",
    middleware: JOINED_GROUP_PAGE,
    request: {
      params: PAGE_PARAMS,
      body: { required: true, content: jsonContent(MOVE_PAGE_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The moved page",
        content: jsonContent(PAGE_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only writers and administrators can move a page",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group or page, or no such folder in the group",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { folderId } = c.req.valid("json");
    const user = c.get("user");
    const group = c.get("group");

    if (!mayAct(group.role, "page:move")) {
      return c.json(
        { error: "Only writers and administrators can move a page" },
        STATUS_CODE.Forbidden,
      );
    }

    const folder = folderId === null
      ? null
      : await folderOf(group.id, folderId);
    if (folder === undefined) {
      return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
    }

    const moved = await db.transaction().execute((transaction) =>
      WritingPageService.movePage(
        transaction,
        group.id,
        c.get("page").id,
        folder?.id ?? null,
        user.id,
      )
    );
    if (moved === undefined) {
      return c.json({ error: "Page not found" }, STATUS_CODE.NotFound);
    }

    return c.json(moved, STATUS_CODE.OK);
  },
);
