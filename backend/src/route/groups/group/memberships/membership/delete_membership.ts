import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
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
  OK_RESPONSE,
} from "@/src/http/response.ts";
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
    summary: "Leave a group, or remove a member the current user administers",
    description:
      "Removes a membership or a pending invitation: one's own, which also declines an invitation, or anybody's for an administrator of the group. Removing the last remaining member deletes the group along with it.",
    operationId: "removeMember",
    middleware: authenticated,
    request: { params: MEMBERSHIP_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The membership was removed",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description:
          "Not the current user's own membership, and not an administrator",
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

    // The shape `mayModify` gives posts, threads and steps: an administrator of the group, or
    // whoever the thing belongs to. Here that is the member whose own membership it is, which
    // is how leaving and declining an invitation are reached.
    const isOwnMembership = userId === user.id;
    if (
      !isOwnMembership &&
      await WritingGroupService.selectRoleForUser(user, groupId) !==
        "administrator"
    ) {
      return c.json(
        { error: "Only administrators can remove another member" },
        STATUS_CODE.Forbidden,
      );
    }

    const removed = await UserInWritingGroupService
      .deleteMembership(groupId, userId);

    if (!removed) {
      return c.json({ error: "Membership not found" }, STATUS_CODE.NotFound);
    }

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
