import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FOLDER_NOT_EMPTY,
  FORBIDDEN_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";
import { WRITING_FOLDER_SCHEMA } from "@/src/database/schema.ts";

const FOLDER_PARAMS = z.object({
  folderId: WRITING_FOLDER_SCHEMA.shape.id,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Delete an empty folder of the public forum",
    description:
      "Operators only, and only when it holds nothing: no folder, thread or page. Removing what is inside it is #62's, not this.",
    operationId: "deleteForumFolder",
    middleware: authenticated,
    request: { params: FOLDER_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The folder was deleted",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such folder in the forum",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Conflict]: {
        description: "The folder still holds something",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { folderId } = c.req.valid("param");
    const user = c.get("user");

    if (!mayActInForum(user, "folder:delete")) {
      return c.json(
        { error: "Only operators can change the forum's structure" },
        STATUS_CODE.Forbidden,
      );
    }

    const outcome = await ForumService.deleteFolder(folderId);

    if (outcome === "notFound") {
      return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
    }

    if (outcome === "notEmpty") {
      return c.json(
        {
          error: "Empty the folder before deleting it",
          code: FOLDER_NOT_EMPTY,
        },
        STATUS_CODE.Conflict,
      );
    }

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
