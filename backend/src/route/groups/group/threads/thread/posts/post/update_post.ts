import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { POST_RESPONSE } from "@/src/response_schema.ts";
import { POSTS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { PostService } from "@/src/service/post_service.ts";
import { mayModify } from "@/src/service/writing_group_authorization.ts";
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

const POST_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  threadId: THREAD_SCHEMA.shape.id,
  postId: POST_SCHEMA.shape.id,
});

// Setting isDraft to false is how a draft gets published.
const UPDATE_POST_BODY = POST_SCHEMA
  .pick({ text: true, isDraft: true })
  .extend({ text: POST_SCHEMA.shape.text.min(1) })
  .partial()
  .refine(
    (changes) => Object.values(changes).some((value) => value !== undefined),
    { message: "Provide at least one field to update" },
  );

export default new OpenAPIHono().openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: [POSTS_TAG],
    summary: "Edit or publish a post the current user wrote or administers",
    description:
      "Edits a post's text, or publishes a draft by clearing its draft flag. Only its author, or an administrator of the group, may change it.",
    operationId: "updatePost",
    middleware: requireSession,
    request: {
      params: POST_PARAMS,
      body: { required: true, content: jsonContent(UPDATE_POST_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The updated post",
        content: jsonContent(POST_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only the author or an administrator may change it",
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
    const changes = c.req.valid("json");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const post = await PostService.selectPost(threadId, postId, user.id);
    if (post === undefined) {
      return c.json({ error: "Post not found" }, STATUS_CODE.NotFound);
    }

    if (!mayModify(role, post.createdBy, user.id)) {
      return c.json(
        { error: "Only the author or an administrator can change a post" },
        STATUS_CODE.Forbidden,
      );
    }

    const updated = await PostService.updatePost(postId, changes);
    if (updated === undefined) {
      return c.json({ error: "Post not found" }, STATUS_CODE.NotFound);
    }

    return c.json(updated, STATUS_CODE.OK);
  },
);
