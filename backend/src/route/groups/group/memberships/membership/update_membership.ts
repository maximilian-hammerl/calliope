import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { MEMBERSHIP_RESPONSE } from "@/src/http/response_schema.ts";
import { MEMBERSHIPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { UserInWritingGroupService } from "@/src/service/user_in_writing_group_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import {
  USER_IN_WRITING_GROUP_SCHEMA,
  WRITING_GROUP_SCHEMA,
} from "@/src/database/schema.ts";

const MEMBERSHIP_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  userId: USER_IN_WRITING_GROUP_SCHEMA.shape.userId,
});

// Only the role: the status belongs to the invited user, not to an administrator.
const UPDATE_MEMBERSHIP_BODY = USER_IN_WRITING_GROUP_SCHEMA.pick({
  role: true,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: [MEMBERSHIPS_TAG],
    summary: "Change a member's role in a group the current user administers",
    description:
      "Changes a member's role. The status cannot be changed here: accepting an invitation is the invited user's to do.",
    operationId: "updateMembership",
    middleware: authenticated,
    request: {
      params: MEMBERSHIP_PARAMS,
      body: { required: true, content: jsonContent(UPDATE_MEMBERSHIP_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The updated membership",
        content: jsonContent(MEMBERSHIP_RESPONSE),
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
        description: "No such group, or no such membership",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId, userId } = c.req.valid("param");
    const { role } = c.req.valid("json");
    const user = c.get("user");

    const writingGroup = await WritingGroupService.selectVisibleWritingGroup(
      user,
      groupId,
    );
    if (writingGroup === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    if (
      await WritingGroupService.selectRoleForUser(user, groupId) !==
        "administrator"
    ) {
      return c.json(
        { error: "Only administrators can change a role" },
        STATUS_CODE.Forbidden,
      );
    }

    const membership = await UserInWritingGroupService.updateRole(
      groupId,
      userId,
      role,
      user.id,
    );

    if (membership === undefined) {
      return c.json({ error: "Membership not found" }, STATUS_CODE.NotFound);
    }

    return c.json(membership, STATUS_CODE.OK);
  },
);
