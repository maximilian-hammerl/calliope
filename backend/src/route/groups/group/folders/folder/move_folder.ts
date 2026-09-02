import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FOLDER_RESPONSE } from "@/src/http/response_schema.ts";
import { FOLDERS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import {
  MAX_FOLDER_DEPTH,
  WritingFolderService,
} from "@/src/service/writing_folder_service.ts";
import { mayAct } from "@/src/service/writing_group_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FOLDER_CYCLE,
  FOLDER_TOO_DEEP,
  jsonContent,
} from "@/src/http/response.ts";
import {
  WRITING_FOLDER_SCHEMA,
  WRITING_GROUP_SCHEMA,
} from "@/src/database/schema.ts";

const FOLDER_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
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
    tags: [FOLDERS_TAG],
    summary: "Move a folder under another one, or to the root",
    description:
      `Everything inside it moves with it. Refused when the target is the folder itself or something inside it, and when the subtree would reach past ${MAX_FOLDER_DEPTH} levels — which depends on its deepest descendant, not on the folder.`,
    operationId: "moveFolder",
    middleware: authenticated,
    request: {
      params: FOLDER_PARAMS,
      body: { required: true, content: jsonContent(MOVE_FOLDER_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The moved folder",
        content: jsonContent(FOLDER_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only writers and administrators can move a folder",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group or folder, or no such target in the group",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.UnprocessableEntity]: {
        description:
          "The target is inside it, or the subtree would be too deep",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId, folderId } = c.req.valid("param");
    const { parentFolderId } = c.req.valid("json");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const folder = await WritingFolderService.selectFolder(groupId, folderId);
    if (folder === undefined) {
      return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
    }

    if (!mayAct(role, "folder:move")) {
      return c.json(
        { error: "Only writers and administrators can move a folder" },
        STATUS_CODE.Forbidden,
      );
    }

    const outcome = await WritingFolderService.moveFolder(
      groupId,
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
