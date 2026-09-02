import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { PAGE_RESPONSE } from "@/src/http/response_schema.ts";
import { PAGES_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingPageService } from "@/src/service/writing_page_service.ts";
import { mayAct } from "@/src/service/writing_group_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  PAGE_CHANGED,
  PAGE_CHANGED_RESPONSE,
} from "@/src/http/response.ts";
import {
  WRITING_GROUP_SCHEMA,
  WRITING_PAGE_SCHEMA,
} from "@/src/database/schema.ts";
import { DOCUMENT_SCHEMA } from "@/src/document/document_schema.ts";
import { documentToPlainText } from "@/src/document/document_text.ts";
import { PAGE_TITLE_SCHEMA } from "../page_schema.ts";

const PAGE_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  pageId: WRITING_PAGE_SCHEMA.shape.id,
});

/**
 * A whole page, not a patch: a page has one shared body, so an editor saves what it loaded.
 * `loadedAt` is that page's `updatedAt`, and the save is refused if it has moved on.
 */
const UPDATE_PAGE_BODY = z.object({
  title: PAGE_TITLE_SCHEMA,
  document: DOCUMENT_SCHEMA,
  loadedAt: WRITING_PAGE_SCHEMA.shape.lastActivityAt.openapi({
    description:
      "The page's `lastActivityAt` as it was received, unchanged: it is compared exactly, and a round trip through a date type drops the microseconds and refuses every save.",
  }),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/",
    tags: [PAGES_TAG],
    summary: "Save a page the current user wrote or administers",
    description:
      "Refused with 409 when somebody else saved since the page was loaded, so an edit cannot be overwritten unseen. Any writer or administrator may change it: a page is material the group keeps, not a post that belongs to whoever wrote it.",
    operationId: "updatePage",
    middleware: authenticated,
    request: {
      params: PAGE_PARAMS,
      body: { required: true, content: jsonContent(UPDATE_PAGE_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The saved page",
        content: jsonContent(PAGE_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only writers and administrators can change a page",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group or page, or the group is not the user's",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Conflict]: {
        description: "The page was saved by somebody else in the meantime",
        content: jsonContent(PAGE_CHANGED_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId, pageId } = c.req.valid("param");
    const { title, document, loadedAt } = c.req.valid("json");
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

    const page = await WritingPageService.selectPage(groupId, pageId);
    if (page === undefined) {
      return c.json({ error: "Page not found" }, STATUS_CODE.NotFound);
    }

    if (!mayAct(role, "page:change")) {
      return c.json(
        { error: "Only writers and administrators can change a page" },
        STATUS_CODE.Forbidden,
      );
    }

    const outcome = await WritingPageService.updatePage(
      groupId,
      pageId,
      loadedAt,
      { title, document },
      user.id,
    );
    if (outcome === undefined) {
      return c.json({ error: "Page not found" }, STATUS_CODE.NotFound);
    }

    if (outcome.kind === "stale") {
      return c.json(
        {
          error: "The page was changed since you opened it",
          code: PAGE_CHANGED,
          updatedByUsername: outcome.page.updatedByUsername,
        },
        STATUS_CODE.Conflict,
      );
    }

    return c.json(outcome.page, STATUS_CODE.OK);
  },
);
