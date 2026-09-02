import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { POSTS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingPostService } from "@/src/service/writing_post_service.ts";
import { mayAct } from "@/src/service/writing_group_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";
import {
  WRITING_GROUP_SCHEMA,
  WRITING_POST_SCHEMA,
  WRITING_THREAD_SCHEMA,
} from "@/src/database/schema.ts";

const POST_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  threadId: WRITING_THREAD_SCHEMA.shape.id,
  postId: WRITING_POST_SCHEMA.shape.id,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [POSTS_TAG],
    summary: "Delete a post the current user wrote or administers",
    description:
      "Deletes a post. Only its author, or an administrator of the group, may delete it.",
    operationId: "deletePost",
    middleware: authenticated,
    request: { params: POST_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The post was deleted",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only the author or an administrator may delete it",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such post, or it is somebody else's unpublished draft",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId, threadId, postId } = c.req.valid("param");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const post = await WritingPostService.selectPost(threadId, postId, user.id);
    if (post === undefined) {
      return c.json({ error: "Post not found" }, STATUS_CODE.NotFound);
    }

    if (
      !mayAct(role, "post:delete", {
        createdBy: post.createdBy,
        userId: user.id,
      })
    ) {
      return c.json(
        { error: "Only the author or an administrator can delete a post" },
        STATUS_CODE.Forbidden,
      );
    }

    await WritingPostService.deletePost(postId);

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
