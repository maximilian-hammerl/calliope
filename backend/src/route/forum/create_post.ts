import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { POST_RESPONSE } from "@/src/http/response_schema.ts";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import { documentToPlainText } from "@/src/document/document_text.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";
import { DOCUMENT_SCHEMA } from "@/src/document/document_schema.ts";
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

const CREATE_POST_BODY = z.object({
  document: DOCUMENT_SCHEMA,
  /** A draft belongs to its author until published, exactly as a group's does. */
  isDraft: WRITING_POST_SCHEMA.shape.isDraft.default(false),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Reply to a thread the current user may write in",
    description:
      "Members may reply where the thread grants `write`; operators may anywhere. A thread the member may not see answers 404 rather than 403.",
    operationId: "createForumPost",
    middleware: authenticated,
    request: {
      params: THREAD_PARAMS,
      body: { required: true, content: jsonContent(CREATE_POST_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The post",
        content: jsonContent(POST_RESPONSE),
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
    const { document, isDraft } = c.req.valid("json");
    const user = c.get("user");

    // What may be seen before what may be done: a thread they cannot see does not exist to them.
    const thread = await ForumService.selectThread(user, threadId);
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    // The bound is on the prose, not the serialisation — see `document_schema.ts`.
    const text = documentToPlainText(document);
    if (text.length === 0 || text.length > TEXT_LIMIT.documentText) {
      return c.json(
        {
          error:
            `A post holds between 1 and ${TEXT_LIMIT.documentText} characters`,
        },
        STATUS_CODE.BadRequest,
      );
    }

    // A post carries no permission of its own; the thread it is in is what governs it.
    if (
      !mayActInForum(user, thread.effectiveMemberPermission, "post:create")
    ) {
      return c.json(
        { error: "You cannot write in this thread" },
        STATUS_CODE.Forbidden,
      );
    }

    const post = await ForumService.insertPost(
      threadId,
      document,
      isDraft,
      user.id,
    );

    return c.json(post, STATUS_CODE.Created);
  },
);
