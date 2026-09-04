import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { listQuery } from "@/src/list/list_endpoint_query.ts";
import { POST_RESPONSE } from "@/src/http/response_schema.ts";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import { WritingPostService } from "@/src/service/writing_post_service.ts";
import {
  FAVOURITE_FILTER,
  listQuerySchema,
  listResponseSchema,
} from "@/src/list/list_endpoint.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import {
  WRITING_POST_SCHEMA,
  WRITING_THREAD_SCHEMA,
} from "@/src/database/schema.ts";

const THREAD_PARAMS = z.object({ threadId: WRITING_THREAD_SCHEMA.shape.id });

const SORT_ATTRIBUTE = WRITING_POST_SCHEMA
  .keyof()
  .extract(["createdAt"])
  .default("createdAt")
  .transform((attribute) => `writingPost.${attribute}` as const);

const LIST_POSTS_BODY = listQuerySchema(SORT_ATTRIBUTE, {
  favourite: FAVOURITE_FILTER,
  isDraft: WRITING_POST_SCHEMA.shape.isDraft.default(false),
}, "asc");

/**
 * The group's endpoint with a different gate: `listPosts` is scoped to a thread and never asked
 * which group, so paging, ordering and the draft rule need nothing new.
 */
export default new OpenAPIHono().openapi(
  createRoute({
    method: "query",
    path: "/",
    tags: [FORUM_TAG],
    summary: "List the posts of a forum thread, plus the caller's own drafts",
    description:
      "Returns a page of the thread's published posts, plus the current user's own unpublished drafts. Other members' drafts are never included.",
    operationId: "listForumPosts",
    middleware: authenticated,
    request: {
      params: THREAD_PARAMS,
      body: { required: true, content: jsonContent(LIST_POSTS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of posts",
        content: jsonContent(listResponseSchema(POST_RESPONSE)),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such thread, or the member may not see it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { threadId } = c.req.valid("param");
    const user = c.get("user");

    const thread = await ForumService.selectThread(user, threadId);
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    const page = await WritingPostService.listPosts(
      threadId,
      user.id,
      listQuery(c.req.valid("json")),
    );

    return c.json(page, STATUS_CODE.OK);
  },
);
