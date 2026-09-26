import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { listQuery } from "@/src/list/list_endpoint_query.ts";
import { POST_RESPONSE } from "@/src/http/response_schema.ts";
import { POSTS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { VISIBLE_GROUP_THREAD } from "@/src/scope/chains.ts";
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
  WRITING_GROUP_SCHEMA,
  WRITING_POST_SCHEMA,
  WRITING_THREAD_SCHEMA,
} from "@/src/database/schema.ts";

const THREAD_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  threadId: WRITING_THREAD_SCHEMA.shape.id,
});

const SORT_ATTRIBUTE = WRITING_POST_SCHEMA
  .keyof()
  .extract(["createdAt"])
  .default("createdAt")
  // Oldest first by default, because a thread reads in the order it was written.
  .transform((attribute) => `writingPost.${attribute}` as const);

/**
 * Published by default, so a client that says nothing never renders a draft into the thread.
 * Passing `true` returns the caller's own drafts — `readableBy` already makes another
 * member's draft unreachable, whatever is asked for here.
 */
const LIST_POSTS_BODY = listQuerySchema(SORT_ATTRIBUTE, {
  favourite: FAVOURITE_FILTER,
  isDraft: WRITING_POST_SCHEMA.shape.isDraft.default(false),
}, "asc");

export default new OpenAPIHono().openapi(
  createRoute({
    method: "query",
    path: "/",
    tags: [POSTS_TAG],
    summary: "List the posts of a thread, plus the current user's own drafts",
    description:
      "Returns a page of the thread's published posts, plus the current user's own unpublished drafts. Other members' drafts are never included.",
    operationId: "listPosts",
    middleware: VISIBLE_GROUP_THREAD,
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
        description: "No such group or thread, or the user is not a member",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  // Whatever the reader may *see*, which `visibleGroup` settles: a public group's writing is
  // readable by the community. Drafts stay with their author, and writing still needs a role.
  async (c) => {
    // Other members' drafts are not published yet, so they stay out of the page.
    const page = await WritingPostService.listPosts(
      c.get("thread").id,
      c.get("user").id,
      listQuery(c.req.valid("json")),
    );

    return c.json(page, STATUS_CODE.OK);
  },
);
