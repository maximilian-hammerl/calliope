import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FOLDERS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingFolderService } from "@/src/service/writing_folder_service.ts";
import { mayAct } from "@/src/service/writing_group_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FOLDER_NOT_EMPTY,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";
import {
  WRITING_FOLDER_SCHEMA,
  WRITING_GROUP_SCHEMA,
} from "@/src/database/schema.ts";

const FOLDER_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  folderId: WRITING_FOLDER_SCHEMA.shape.id,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [FOLDERS_TAG],
    summary: "Delete an empty folder",
    description:
      "Only an empty one: deleting a folder with anything in it would take writing with it, and there is no history to recover it from. Empty it first.",
    operationId: "deleteFolder",
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
      [STATUS_CODE.Forbidden]: {
        description: "Only writers and administrators can delete a folder",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group or folder, or the group is not the user's",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Conflict]: {
        description: "The folder still holds a folder, a page or a thread",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId, folderId } = c.req.valid("param");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const folder = await WritingFolderService.selectFolder(groupId, folderId);
    if (folder === undefined) {
      return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
    }

    if (!mayAct(role, "folder:delete")) {
      return c.json(
        { error: "Only writers and administrators can delete a folder" },
        STATUS_CODE.Forbidden,
      );
    }

    const outcome = await WritingFolderService.deleteFolder(groupId, folderId);

    // Gone since the read above: a 404, rather than a refusal about contents it no longer has.
    if (outcome === undefined) {
      return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
    }

    if (outcome === "notEmpty") {
      return c.json(
        { error: "The folder is not empty", code: FOLDER_NOT_EMPTY },
        STATUS_CODE.Conflict,
      );
    }

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
