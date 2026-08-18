import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { POST_RESPONSE } from "@/src/response_schema.ts";
import { POSTS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { ThreadService } from "@/src/service/thread_service.ts";
import { PostService } from "@/src/service/post_service.ts";
import { mayWrite } from "@/src/service/writing_group_authorization.ts";
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

const CREATE_POST_BODY = POST_SCHEMA
  .pick({ text: true, isDraft: true })
  .extend({
    text: POST_SCHEMA.shape.text.min(1),
    // Published unless the author says otherwise.
    isDraft: POST_SCHEMA.shape.isDraft.default(false),
  });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [POSTS_TAG],
    summary: "Add a post to a thread in a group the current user writes in",
    description:
      "Adds a post to the thread, either published or as a draft. Writers and administrators may write posts; readers may not.",
    operationId: "createPost",
    middleware: requireSession,
    request: {
      params: THREAD_PARAMS,
      body: { required: true, content: jsonContent(CREATE_POST_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The post was created",
        content: jsonContent(POST_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Readers cannot write posts",
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
    const { text, isDraft } = c.req.valid("json");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    if (!mayWrite(role)) {
      return c.json(
        { error: "Only writers and administrators can write a post" },
        STATUS_CODE.Forbidden,
      );
    }

    const thread = await ThreadService.selectThread(groupId, threadId);
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    const post = await PostService.insertPost(threadId, text, isDraft, user.id);

    return c.json(post, STATUS_CODE.Created);
  },
);
