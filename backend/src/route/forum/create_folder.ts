import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_FOLDER_RESPONSE } from "@/src/http/response_schema.ts";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import { MAX_FOLDER_DEPTH } from "@/src/service/writing_folder_service.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";
import {
  FOLDER_DESCRIPTION_SCHEMA,
  FOLDER_TITLE_SCHEMA,
} from "@/src/http/request_schema.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FOLDER_TOO_DEEP,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import {
  FORUM_PERMISSION_SCHEMA,
  WRITING_FOLDER_SCHEMA,
} from "@/src/database/schema.ts";

const CREATE_FOLDER_BODY = z.object({
  title: FOLDER_TITLE_SCHEMA,
  description: FOLDER_DESCRIPTION_SCHEMA.optional(),
  /** Absent puts it at the forum's root, which is where a top-level room belongs. */
  parentFolderId: WRITING_FOLDER_SCHEMA.shape.parentFolderId.optional(),
  /**
   * What members may do in it. Required rather than defaulted: the whole point of a room is the
   * answer to this, and a default would make the most consequential field the easiest to miss.
   */
  memberPermission: FORUM_PERMISSION_SCHEMA,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Add a folder to the public forum",
    description:
      `Operators only: the forum's structure has no owner below them, since it has no administrators. The permission it grants members is reduced by whatever is above it, so a folder cannot widen its parent. Nests at most ${MAX_FOLDER_DEPTH} levels deep.`,
    operationId: "createForumFolder",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(CREATE_FOLDER_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The folder",
        content: jsonContent(FORUM_FOLDER_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such parent folder in the forum",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.UnprocessableEntity]: {
        description: "The folder would nest too deeply",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { title, description, parentFolderId, memberPermission } = c.req
      .valid(
        "json",
      );
    const user = c.get("user");

    if (!mayActInForum(user, "folder:create")) {
      return c.json(
        { error: "Only operators can change the forum's structure" },
        STATUS_CODE.Forbidden,
      );
    }

    const outcome = await ForumService.insertFolder(user, {
      title,
      description: description ?? null,
      parentFolderId: parentFolderId ?? null,
      memberPermission,
    });

    if (outcome.kind === "noSuchParent") {
      return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
    }

    if (outcome.kind === "tooDeep") {
      return c.json(
        {
          error: `Folders nest at most ${MAX_FOLDER_DEPTH} levels deep`,
          code: FOLDER_TOO_DEEP,
        },
        STATUS_CODE.UnprocessableEntity,
      );
    }

    return c.json(outcome.folder, STATUS_CODE.Created);
  },
);
