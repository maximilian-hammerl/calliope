import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { PAGE_RESPONSE } from "@/src/http/response_schema.ts";
import { PAGES_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingPageService } from "@/src/service/writing_page_service.ts";
import { mayAct } from "@/src/service/writing_group_authorization.ts";
import { WritingFolderService } from "@/src/service/writing_folder_service.ts";
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
import { DOCUMENT_SCHEMA } from "@/src/document/document_schema.ts";
import { documentToPlainText } from "@/src/document/document_text.ts";
import { PAGE_TITLE_SCHEMA } from "./page_schema.ts";

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

// `text` is derived from the document by the server, as a post's projection is.
const CREATE_PAGE_BODY = z.object({
  title: PAGE_TITLE_SCHEMA,
  document: DOCUMENT_SCHEMA,
  // Absent puts it at the root of the group's tree. Moving it later is its own operation.
  folderId: WRITING_PAGE_SCHEMA.shape.folderId.optional(),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [PAGES_TAG],
    summary: "Add a page to a group",
    description:
      "Pages hold material the group revises — a place, a character, a rule — rather than a conversation.",
    operationId: "createPage",
    middleware: authenticated,
    request: {
      params: GROUP_PARAMS,
      body: { required: true, content: jsonContent(CREATE_PAGE_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The page was added",
        content: jsonContent(PAGE_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only writers and administrators can add pages",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group, or no such folder in it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId } = c.req.valid("param");
    const { title, document, folderId } = c.req.valid("json");
    const user = c.get("user");

    // The bound is on the prose, not the serialisation — see `document_schema.ts`. No minimum:
    // a page is named by its title, so an empty one is a stub somebody has yet to fill.
    if (documentToPlainText(document).length > TEXT_LIMIT.documentText) {
      return c.json(
        { error: `A page holds at most ${TEXT_LIMIT.documentText} characters` },
        STATUS_CODE.BadRequest,
      );
    }

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    if (!mayAct(role, "page:create")) {
      return c.json(
        { error: "Only writers and administrators can add pages" },
        STATUS_CODE.Forbidden,
      );
    }

    // Resolved against this group, so a folder id from another group cannot be borrowed.
    if (folderId !== undefined && folderId !== null) {
      const folder = await WritingFolderService.selectFolder(groupId, folderId);
      if (folder === undefined) {
        return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
      }
    }

    const page = await WritingPageService.insertPage(
      groupId,
      title,
      document,
      user.id,
      folderId ?? null,
    );
    return c.json(page, STATUS_CODE.Created);
  },
);
