import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { POST_RESPONSE } from "@/src/http/response_schema.ts";
import { POSTS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingPostService } from "@/src/service/writing_post_service.ts";
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

const POST_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  threadId: WRITING_THREAD_SCHEMA.shape.id,
  postId: WRITING_POST_SCHEMA.shape.id,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/",
    tags: [POSTS_TAG],
    summary: "Fetch a post of a thread the current user can read",
    description:
      "Returns a single post. Another member's unpublished draft is reported as missing, including to administrators.",
    operationId: "getPost",
    middleware: authenticated,
    request: { params: POST_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The post",
        content: jsonContent(POST_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such post, or it is somebody else's unpublished draft",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
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

    // Another member's draft is reported as missing rather than forbidden.
    const post = await WritingPostService.selectPost(threadId, postId, user.id);
    if (post === undefined) {
      return c.json({ error: "Post not found" }, STATUS_CODE.NotFound);
    }

    return c.json(post, STATUS_CODE.OK);
  },
);
