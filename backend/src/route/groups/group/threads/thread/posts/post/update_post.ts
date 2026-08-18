import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import {
  documentBodySchema,
  documentToText,
  parseDocument,
} from "@/src/document.ts";
import { POST_RESPONSE } from "@/src/response_schema.ts";
import { POSTS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingPostService } from "@/src/service/writing_post_service.ts";
import { mayModify } from "@/src/service/writing_group_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/response.ts";
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

// Setting isDraft to false is how a draft gets published. `text` is not accepted: it is
// derived from the document, so the two can never disagree.
const UPDATE_POST_BODY = z
  .object({
    document: documentBodySchema(TEXT_LIMIT.postText).optional(),
    isDraft: WRITING_POST_SCHEMA.shape.isDraft.optional(),
  })
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

    const post = await WritingPostService.selectPost(threadId, postId, user.id);
    if (post === undefined) {
      return c.json({ error: "Post not found" }, STATUS_CODE.NotFound);
    }

    if (!mayModify(role, post.createdBy, user.id)) {
      return c.json(
        { error: "Only the author or an administrator can change a post" },
        STATUS_CODE.Forbidden,
      );
    }

    // Validated by the body schema above; parsing again is what strips anything not ours.
    const document = changes.document === undefined
      ? undefined
      : parseDocument(changes.document);

    const updated = await WritingPostService.updatePost(
      postId,
      {
        ...changes,
        document,
        // Kept in step with the document rather than accepted separately.
        ...(document === undefined ? {} : { text: documentToText(document) }),
      },
      post.isDraft,
    );
    if (updated === undefined) {
      return c.json({ error: "Post not found" }, STATUS_CODE.NotFound);
    }

    return c.json(updated, STATUS_CODE.OK);
  },
);
