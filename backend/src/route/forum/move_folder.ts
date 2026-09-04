import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FORUM_FOLDER_RESPONSE } from "@/src/http/response_schema.ts";
import { FORUM_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ForumService } from "@/src/service/forum_service.ts";
import { MAX_FOLDER_DEPTH } from "@/src/service/writing_folder_service.ts";
import { mayActInForum } from "@/src/service/forum_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FOLDER_CYCLE,
  FOLDER_TOO_DEEP,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { WRITING_FOLDER_SCHEMA } from "@/src/database/schema.ts";

const FOLDER_PARAMS = z.object({
  folderId: WRITING_FOLDER_SCHEMA.shape.id,
});

// Null moves it to the root. `depth` is the server's to work out, here as on a create.
const MOVE_FOLDER_BODY = z.object({
  parentFolderId: WRITING_FOLDER_SCHEMA.shape.parentFolderId,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/",
    tags: [FORUM_TAG],
    summary: "Move a folder of the public forum, or take it to the root",
    description:
      `Operators only. Everything inside it moves with it, and every permission below is reduced along the new path — so moving a room into a closed one closes what it holds. Refused when the target is the folder itself or something inside it, and when the subtree would reach past ${MAX_FOLDER_DEPTH} levels, which depends on its deepest descendant.`,
    operationId: "moveForumFolder",
    middleware: authenticated,
    request: {
      params: FOLDER_PARAMS,
      body: { required: true, content: jsonContent(MOVE_FOLDER_BODY) },
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
        description: "No such folder in the forum, or no such target",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.UnprocessableEntity]: {
        description: "The move would make a cycle, or nest too deeply",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { folderId } = c.req.valid("param");
    const { parentFolderId } = c.req.valid("json");
    const user = c.get("user");

    if (!mayActInForum(user, "folder:move")) {
      return c.json(
        { error: "Only operators can change the forum's structure" },
        STATUS_CODE.Forbidden,
      );
    }

    const outcome = await ForumService.moveFolder(
      user,
      folderId,
      parentFolderId,
    );

    if (outcome === undefined || outcome.kind === "noSuchParent") {
      return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
    }

    if (outcome.kind === "cycle") {
      return c.json(
        {
          error: "A folder cannot move into itself or into something it holds",
          code: FOLDER_CYCLE,
        },
        STATUS_CODE.UnprocessableEntity,
      );
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

    return c.json(outcome.folder, STATUS_CODE.OK);
  },
);
