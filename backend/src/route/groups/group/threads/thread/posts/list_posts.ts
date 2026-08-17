import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { POSTS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { ThreadService } from "@/src/service/thread_service.ts";
import { PostService } from "@/src/service/post_service.ts";
import { listQuerySchema, listResponseSchema } from "@/src/list_endpoint.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/response.ts";
import {
  POST_SCHEMA,
  THREAD_SCHEMA,
  WRITING_GROUP_SCHEMA,
} from "@/src/database/schema.ts";

const THREAD_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  threadId: THREAD_SCHEMA.shape.id,
});

const SORT_ATTRIBUTE = POST_SCHEMA
  .keyof()
  .extract(["createdAt", "updatedAt"])
  .default("createdAt")
  // Oldest first by default, because a thread reads in the order it was written.
  .transform((attribute) => `post.${attribute}` as const);

const LIST_POSTS_BODY = listQuerySchema(SORT_ATTRIBUTE, {}, "asc");

export default new OpenAPIHono().openapi(
  createRoute({
    method: "query",
    path: "/",
    tags: [POSTS_TAG],
    summary: "List the posts of a thread, plus the current user's own drafts",
    description:
      "Returns a page of the thread's published posts, plus the current user's own unpublished drafts. Other members' drafts are never included.",
    operationId: "listPosts",
    middleware: requireSession,
    request: {
      params: THREAD_PARAMS,
      body: { required: true, content: jsonContent(LIST_POSTS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of posts",
        content: jsonContent(listResponseSchema(POST_SCHEMA)),
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
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId, threadId } = c.req.valid("param");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const thread = await ThreadService.selectThread(groupId, threadId);
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    // Other members' drafts are not published yet, so they stay out of the page.
    const page = await PostService.listPosts(
      threadId,
      user.id,
      c.req.valid("json"),
    );

    return c.json(page, STATUS_CODE.OK);
  },
);
