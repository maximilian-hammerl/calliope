import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_PAGE_RESPONSE } from "@/src/http/response_schema.ts";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import { documentToPlainText } from "@/src/document/document_text.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";
import { PAGE_TITLE_SCHEMA } from "@/src/route/groups/group/pages/page_schema.ts";
import { DOCUMENT_SCHEMA } from "@/src/document/document_schema.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
  PAGE_CHANGED,
  PAGE_CHANGED_RESPONSE,
} from "@/src/http/response.ts";
import { WRITING_PAGE_SCHEMA } from "@/src/database/schema.ts";

const PAGE_PARAMS = z.object({ pageId: WRITING_PAGE_SCHEMA.shape.id });

const UPDATE_PAGE_BODY = z.object({
  title: PAGE_TITLE_SCHEMA,
  document: DOCUMENT_SCHEMA,
  /** What the client loaded: the write is conditional on nobody having saved since. */
  loadedAt: WRITING_PAGE_SCHEMA.shape.lastActivityAt,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Rewrite a page of the forum",
    description:
      "A page is written together rather than owned, so whoever may write here may change it — which is why this asks the page's own permission rather than who wrote it.",
    operationId: "updateForumPage",
    middleware: authenticated,
    request: {
      params: PAGE_PARAMS,
      body: { required: true, content: jsonContent(UPDATE_PAGE_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The page as it now stands",
        content: jsonContent(FORUM_PAGE_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such page, or the member may not see it",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Conflict]: {
        description: "The page was saved by somebody else in the meantime",
        content: jsonContent(PAGE_CHANGED_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { pageId } = c.req.valid("param");
    const { title, document, loadedAt } = c.req.valid("json");
    const user = c.get("user");

    const page = await ForumService.selectPageForReader(user, pageId);
    if (page === undefined) {
      return c.json({ error: "Page not found" }, STATUS_CODE.NotFound);
    }

    // The bound is on the prose, not the serialisation — see `document_schema.ts`. No minimum:
    // a page is named by its title, so an empty one is a stub somebody has yet to fill.
    if (documentToPlainText(document).length > TEXT_LIMIT.documentText) {
      return c.json(
        { error: `A page holds at most ${TEXT_LIMIT.documentText} characters` },
        STATUS_CODE.BadRequest,
      );
    }

    if (!mayActInForum(user, page.effectiveMemberPermission, "page:change")) {
      return c.json(
        { error: "You cannot change this page" },
        STATUS_CODE.Forbidden,
      );
    }

    const outcome = await ForumService.updatePage(user, pageId, loadedAt, {
      title,
      document,
    });
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
