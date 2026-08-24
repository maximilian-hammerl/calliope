import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { POST_RESPONSE } from "@/src/http/response_schema.ts";
import { POSTS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingThreadService } from "@/src/service/writing_thread_service.ts";
import { WritingPostService } from "@/src/service/writing_post_service.ts";
import { mayWrite } from "@/src/service/writing_group_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import {
  WRITING_GROUP_SCHEMA,
  WRITING_POST_SCHEMA,
  WRITING_THREAD_SCHEMA,
} from "@/src/database/schema.ts";
import { DOCUMENT_SCHEMA } from "@/src/document/document_schema.ts";
import { documentToPlainText } from "@/src/document/document_text.ts";

const THREAD_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  threadId: WRITING_THREAD_SCHEMA.shape.id,
});

// `text` is not here on purpose: it is derived from the document by the server.
const CREATE_POST_BODY = WRITING_POST_SCHEMA
  .pick({ isDraft: true })
  .extend({
    document: DOCUMENT_SCHEMA,
    // Published unless the author says otherwise.
    isDraft: WRITING_POST_SCHEMA.shape.isDraft.default(false),
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
    middleware: authenticated,
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
    const { document, isDraft } = c.req.valid("json");
    const user = c.get("user");

    // The bound is on the prose, not the serialisation — see `document_schema.ts`. Only here,
    // because only here is the text extracted.
    const text = documentToPlainText(document);
    if (text.length === 0 || text.length > TEXT_LIMIT.postText) {
      return c.json(
        {
          error: `A post holds between 1 and ${TEXT_LIMIT.postText} characters`,
        },
        STATUS_CODE.BadRequest,
      );
    }

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

    const thread = await WritingThreadService.selectThread(groupId, threadId);
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    const post = await WritingPostService.insertPost(
      groupId,
      threadId,
      document,
      isDraft,
      user.id,
    );

    return c.json(post, STATUS_CODE.Created);
  },
);
