import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { POST_RESPONSE } from "@/src/http/response_schema.ts";
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
} from "@/src/http/response.ts";
import {
  WRITING_GROUP_SCHEMA,
  WRITING_POST_SCHEMA,
  WRITING_THREAD_SCHEMA,
} from "@/src/database/schema.ts";
import { DOCUMENT_SCHEMA } from "@/src/document/document_schema.ts";
import { documentToPlainText } from "@/src/document/document_text.ts";

const POST_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  threadId: WRITING_THREAD_SCHEMA.shape.id,
  postId: WRITING_POST_SCHEMA.shape.id,
});

// Setting isDraft to false is how a draft gets published.
// `text` is derived from the document by the server, so it is not accepted here either.
//
const UPDATE_POST_BODY = z.object({
  document: DOCUMENT_SCHEMA.optional(),
  isDraft: WRITING_POST_SCHEMA.shape.isDraft.optional(),
}).refine(
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
    middleware: authenticated,
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

    const post = await WritingPostService.selectPost(threadId, postId, user.id);
    if (post === undefined) {
      return c.json({ error: "Post not found" }, STATUS_CODE.NotFound);
    }

    // The bound is on the prose, not the serialisation — see `document_schema.ts`.
    if (changes.document !== undefined) {
      const text = documentToPlainText(changes.document);
      if (text.length === 0 || text.length > TEXT_LIMIT.documentText) {
        return c.json(
          {
            error:
              `A post holds between 1 and ${TEXT_LIMIT.documentText} characters`,
          },
          STATUS_CODE.BadRequest,
        );
      }
    }

    if (
      !mayAct(role, "post:change", {
        createdBy: post.createdBy,
        userId: user.id,
      })
    ) {
      return c.json(
        { error: "Only the author or an administrator can change a post" },
        STATUS_CODE.Forbidden,
      );
    }

    const updated = await WritingPostService.updatePost(
      postId,
      changes,
      post.isDraft,
      { writingGroupId: groupId, writingThreadId: threadId, actorId: user.id },
    );
    if (updated === undefined) {
      return c.json({ error: "Post not found" }, STATUS_CODE.NotFound);
    }

    return c.json(updated, STATUS_CODE.OK);
  },
);
