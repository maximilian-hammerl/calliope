import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import { WritingPostService } from "@/src/service/writing_post_service.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";
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

const POST_PARAMS = z.object({
  threadId: WRITING_THREAD_SCHEMA.shape.id,
  postId: WRITING_POST_SCHEMA.shape.id,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Remove a post",
    description:
      "Whoever wrote it, and only while they may still write in the thread. Discarding an unpublished draft is this endpoint too.",
    operationId: "deleteForumPost",
    middleware: authenticated,
    request: { params: POST_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The post is gone",
        content: jsonContent(z.object({ ok: z.literal(true) })),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such thread or post, or the member may not see it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { threadId, postId } = c.req.valid("param");
    const user = c.get("user");

    const thread = await ForumService.selectThread(user, threadId);
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    const post = await WritingPostService.selectPost(threadId, postId, user.id);
    if (post === undefined) {
      return c.json({ error: "Post not found" }, STATUS_CODE.NotFound);
    }

    if (
      !mayActInForum(user, thread.effectiveMemberPermission, "post:delete", {
        createdBy: post.createdBy,
        userId: user.id,
      })
    ) {
      return c.json(
        { error: "You cannot remove this post" },
        STATUS_CODE.Forbidden,
      );
    }

    const removed = await WritingPostService.deletePost(postId);
    if (!removed) {
      return c.json({ error: "Post not found" }, STATUS_CODE.NotFound);
    }

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
