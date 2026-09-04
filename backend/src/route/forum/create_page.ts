import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_PAGE_RESPONSE } from "@/src/http/response_schema.ts";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { documentToPlainText } from "@/src/document/document_text.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";
import { FORUM_ROOT_PERMISSION } from "@/src/service/forum_permission.ts";
import { PAGE_TITLE_SCHEMA } from "@/src/route/groups/group/pages/page_schema.ts";
import { DOCUMENT_SCHEMA } from "@/src/document/document_schema.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { WRITING_PAGE_SCHEMA } from "@/src/database/schema.ts";

const CREATE_PAGE_BODY = z.object({
  title: PAGE_TITLE_SCHEMA,
  document: DOCUMENT_SCHEMA,
  /** Absent puts it at the forum's root, which only an operator may write to. */
  folderId: WRITING_PAGE_SCHEMA.shape.folderId.optional(),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Add a page to a folder the current user may write in",
    description:
      "An announcement, an FAQ, the rules. Members may add one where the folder grants `write`; operators may anywhere, the root included.",
    operationId: "createForumPage",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(CREATE_PAGE_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The page",
        content: jsonContent(FORUM_PAGE_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such folder, or the member may not see it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { title, document, folderId } = c.req.valid("json");
    const user = c.get("user");

    let permission = FORUM_ROOT_PERMISSION;
    if (folderId !== undefined && folderId !== null) {
      const folder = await ForumService.selectFolder(user, folderId);
      if (folder === undefined) {
        return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
      }
      permission = folder.effectiveMemberPermission;
    }

    // The bound is on the prose, not the serialisation — see `document_schema.ts`. No minimum:
    // a page is named by its title, so an empty one is a stub somebody has yet to fill.
    if (documentToPlainText(document).length > TEXT_LIMIT.documentText) {
      return c.json(
        { error: `A page holds at most ${TEXT_LIMIT.documentText} characters` },
        STATUS_CODE.BadRequest,
      );
    }

    if (!mayActInForum(user, permission, "page:create")) {
      return c.json(
        { error: "You cannot add a page here" },
        STATUS_CODE.Forbidden,
      );
    }

    const page = await ForumService.insertPage(
      user,
      title,
      document,
      folderId ?? null,
    );

    return c.json(page, STATUS_CODE.Created);
  },
);
