import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_FOLDER_RESPONSE } from "@/src/http/response_schema.ts";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";
import {
  FOLDER_DESCRIPTION_SCHEMA,
  FOLDER_TITLE_SCHEMA,
} from "@/src/http/request_schema.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { WRITING_FOLDER_SCHEMA } from "@/src/database/schema.ts";

const FOLDER_PARAMS = z.object({
  folderId: WRITING_FOLDER_SCHEMA.shape.id,
});

// Its permission is `PUT /permissions/folder/{id}`, and where it sits is `PUT .../parent`: both
// carry a subtree with them, so neither hides inside a rename. Both fields are sent, as the
// group's route takes them — a body free to be empty is an `UPDATE` with nothing to set.
const UPDATE_FOLDER_BODY = z.object({
  title: FOLDER_TITLE_SCHEMA,
  description: FOLDER_DESCRIPTION_SCHEMA,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Rename a folder of the public forum, or change its description",
    description:
      "Operators only. A null description clears it, which is the only way back to none.",
    operationId: "updateForumFolder",
    middleware: authenticated,
    request: {
      params: FOLDER_PARAMS,
      body: { required: true, content: jsonContent(UPDATE_FOLDER_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The folder",
        content: jsonContent(FORUM_FOLDER_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such folder in the forum",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { folderId } = c.req.valid("param");
    const values = c.req.valid("json");
    const user = c.get("user");

    if (!mayActInForum(user, "folder:change")) {
      return c.json(
        { error: "Only operators can change the forum's structure" },
        STATUS_CODE.Forbidden,
      );
    }

    const folder = await ForumService.updateFolder(user, folderId, values);
    if (folder === undefined) {
      return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
    }

    return c.json(folder, STATUS_CODE.OK);
  },
);
