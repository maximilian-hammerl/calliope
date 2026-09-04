import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { notBlank } from "@/src/http/request_schema.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { FORUM_THREAD_RESPONSE } from "@/src/http/response_schema.ts";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";
import { FORUM_ROOT_PERMISSION } from "@/src/service/forum_permission.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { WRITING_THREAD_SCHEMA } from "@/src/database/schema.ts";

const CREATE_THREAD_BODY = z.object({
  title: notBlank(
    WRITING_THREAD_SCHEMA.shape.title.min(1).max(TEXT_LIMIT.threadTitle),
  ),
  /** Absent puts it at the forum's root, which only an operator may write to. */
  folderId: WRITING_THREAD_SCHEMA.shape.folderId.optional(),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Start a thread in a folder the current user may write in",
    description:
      "Members may start a thread where the folder grants `write`; operators may anywhere, the root included. A folder the member may not see answers 404 rather than 403.",
    operationId: "createForumThread",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(CREATE_THREAD_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The thread",
        content: jsonContent(FORUM_THREAD_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such folder, or the member may not see it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { title, folderId } = c.req.valid("json");
    const user = c.get("user");

    // The folder decides, and at the root the forum's constant does — which is what makes
    // creating an operator's act until a folder opens.
    let permission = FORUM_ROOT_PERMISSION;
    if (folderId !== undefined && folderId !== null) {
      const folder = await ForumService.selectFolder(user, folderId);
      if (folder === undefined) {
        return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
      }
      permission = folder.effectiveMemberPermission;
    }

    if (!mayActInForum(user, permission, "thread:create")) {
      return c.json(
        { error: "You cannot start a thread here" },
        STATUS_CODE.Forbidden,
      );
    }

    const thread = await ForumService.insertThread(
      user,
      title,
      folderId ?? null,
    );

    return c.json(thread, STATUS_CODE.Created);
  },
);
