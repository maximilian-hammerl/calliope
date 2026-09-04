import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { FOLDER_RESPONSE } from "@/src/http/response_schema.ts";
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
  jsonContent,
} from "@/src/http/response.ts";
import {
  WRITING_FOLDER_SCHEMA,
  WRITING_GROUP_SCHEMA,
} from "@/src/database/schema.ts";
import {
  FOLDER_DESCRIPTION_SCHEMA,
  FOLDER_TITLE_SCHEMA,
} from "@/src/http/request_schema.ts";

const FOLDER_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  folderId: WRITING_FOLDER_SCHEMA.shape.id,
});

// Both fields together, not a patch: there are two of them, and a null description is how it is
// cleared — which a partial body cannot express without meaning "unchanged" as well.
const UPDATE_FOLDER_BODY = z.object({
  title: FOLDER_TITLE_SCHEMA,
  description: FOLDER_DESCRIPTION_SCHEMA,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "put",
    path: "/",
    tags: [FOLDERS_TAG],
    summary: "Rename a folder, or change what it says",
    description:
      "Where a folder sits is not changed here — moving one is its own operation.",
    operationId: "updateFolder",
    middleware: authenticated,
    request: {
      params: FOLDER_PARAMS,
      body: { required: true, content: jsonContent(UPDATE_FOLDER_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The folder",
        content: jsonContent(FOLDER_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only writers and administrators can change a folder",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group or folder, or the group is not the user's",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId, folderId } = c.req.valid("param");
    const { title, description } = c.req.valid("json");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const folder = await WritingFolderService.selectFolder(groupId, folderId);
    if (folder === undefined) {
      return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
    }

    if (!mayAct(role, "folder:change")) {
      return c.json(
        { error: "Only writers and administrators can change a folder" },
        STATUS_CODE.Forbidden,
      );
    }

    const updated = await WritingFolderService.updateFolder(groupId, folderId, {
      title,
      description,
    });
    if (updated === undefined) {
      return c.json({ error: "Folder not found" }, STATUS_CODE.NotFound);
    }

    return c.json(updated, STATUS_CODE.OK);
  },
);
