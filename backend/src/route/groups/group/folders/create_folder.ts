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
  FOLDER_TOO_DEEP,
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

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

// `depth` is the server's to derive from the parent, so it is not accepted here.
const CREATE_FOLDER_BODY = z.object({
  title: FOLDER_TITLE_SCHEMA,
  description: FOLDER_DESCRIPTION_SCHEMA.optional(),
  parentFolderId: WRITING_FOLDER_SCHEMA.shape.parentFolderId.optional(),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [FOLDERS_TAG],
    summary: "Add a folder to a group",
    description:
      `Nests under \`parentFolderId\`, or sits at the root without one. At most ${MAX_FOLDER_DEPTH} levels deep.`,
    operationId: "createFolder",
    middleware: authenticated,
    request: {
      params: GROUP_PARAMS,
      body: { required: true, content: jsonContent(CREATE_FOLDER_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The folder was added",
        content: jsonContent(FOLDER_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only writers and administrators can add folders",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group, or no such parent folder in it",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.UnprocessableEntity]: {
        description: "The parent is already at the deepest level",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId } = c.req.valid("param");
    const { title, description, parentFolderId } = c.req.valid("json");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    if (!mayAct(role, "folder:create")) {
      return c.json(
        { error: "Only writers and administrators can add folders" },
        STATUS_CODE.Forbidden,
      );
    }

    const outcome = await WritingFolderService.insertFolder(
      groupId,
      {
        title,
        description: description ?? null,
        parentFolderId: parentFolderId ?? null,
      },
      user.id,
    );

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
