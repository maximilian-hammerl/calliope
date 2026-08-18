import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { GROUP_RESPONSE } from "@/src/response_schema.ts";
import { GROUPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/response.ts";
import { WRITING_GROUP_SCHEMA } from "@/src/database/schema.ts";

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

// At least one field is required, otherwise the update would have nothing to set.
const UPDATE_GROUP_BODY = WRITING_GROUP_SCHEMA
  .pick({ title: true, description: true, visibility: true })
  .extend({ title: WRITING_GROUP_SCHEMA.shape.title.min(1) })
  .partial()
  .refine(
    (changes) => Object.values(changes).some((value) => value !== undefined),
    { message: "Provide at least one field to update" },
  );

export default new OpenAPIHono().openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: [GROUPS_TAG],
    summary: "Update a group the user administers",
    description:
      "Changes a group's title, description or visibility. Only an administrator of the group may do so, and only one who has joined it.",
    operationId: "updateGroup",
    middleware: requireSession,
    request: {
      params: GROUP_PARAMS,
      body: { required: true, content: jsonContent(UPDATE_GROUP_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The updated group",
        content: jsonContent(GROUP_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "The user is not an administrator of the group",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group, or it is private and not the user's",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId } = c.req.valid("param");
    const changes = c.req.valid("json");
    const user = c.get("user");

    // Visibility is checked first, so a group the user cannot see stays hidden rather
    // than being revealed by a 403.
    const writingGroup = await WritingGroupService.selectVisibleWritingGroup(
      user,
      groupId,
    );

    if (writingGroup === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const role = await WritingGroupService.selectRoleForUser(user, groupId);

    if (role !== "administrator") {
      return c.json(
        { error: "Only administrators can update a group" },
        STATUS_CODE.Forbidden,
      );
    }

    const updated = await WritingGroupService.updateWritingGroup(
      groupId,
      changes,
    );

    if (updated === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    return c.json(updated, STATUS_CODE.OK);
  },
);
