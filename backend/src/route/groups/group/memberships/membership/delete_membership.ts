import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { MEMBERSHIPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { UserInWritingGroupService } from "@/src/service/user_in_writing_group_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/response.ts";
import { MEMBERSHIP_REMOVAL_RESPONSE } from "@/src/route/groups/group/memberships/removal_response.ts";
import {
  USER_IN_WRITING_GROUP_SCHEMA,
  WRITING_GROUP_SCHEMA,
} from "@/src/database/schema.ts";

const MEMBERSHIP_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  userId: USER_IN_WRITING_GROUP_SCHEMA.shape.userId,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [MEMBERSHIPS_TAG],
    summary: "Remove a member from a group the current user administers",
    description:
      "Removes a member or a pending invitation. Removing the last remaining member deletes the group along with it.",
    operationId: "removeMember",
    middleware: requireSession,
    request: { params: MEMBERSHIP_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The membership was removed",
        content: jsonContent(MEMBERSHIP_REMOVAL_RESPONSE),
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
        { error: "Only administrators can remove a member" },
        STATUS_CODE.Forbidden,
      );
    }

    const { removed, writingGroupDeleted } = await UserInWritingGroupService
      .deleteMembership(groupId, userId);

    if (!removed) {
      return c.json({ error: "Membership not found" }, STATUS_CODE.NotFound);
    }

    return c.json({ ok: true, writingGroupDeleted } as const, STATUS_CODE.OK);
  },
);
