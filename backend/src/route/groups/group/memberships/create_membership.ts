import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { MEMBERSHIP_RESPONSE } from "@/src/http/response_schema.ts";
import { MEMBERSHIPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import {
  userExists,
  UserInWritingGroupService,
} from "@/src/service/user_in_writing_group_service.ts";
import { BanService } from "@/src/service/ban_service.ts";
import { BlockService } from "@/src/service/block_service.ts";
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

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

// `status` is deliberately absent: an invitation is always created as such, and only the
// invited user can turn it into a membership.
const CREATE_MEMBERSHIP_BODY = USER_IN_WRITING_GROUP_SCHEMA
  .pick({ userId: true, role: true })
  .extend({ role: USER_IN_WRITING_GROUP_SCHEMA.shape.role.default("writer") });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [MEMBERSHIPS_TAG],
    summary: "Invite a user to a group the current user administers",
    description:
      "Invites a user to the group with a role. The invitation always starts as such; only the invited user can turn it into a membership.",
    operationId: "inviteMember",
    middleware: authenticated,
    request: {
      params: GROUP_PARAMS,
      body: { required: true, content: jsonContent(CREATE_MEMBERSHIP_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The user was invited",
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
        description: "No such group, or no such user to invite",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Conflict]: {
        description: "The user is already invited to or a member of the group",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId } = c.req.valid("param");
    const { userId, role } = c.req.valid("json");
    const user = c.get("user");

    // Checked before the role, so a group the user cannot see stays hidden.
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
        { error: "Only administrators can invite users" },
        STATUS_CODE.Forbidden,
      );
    }

    if (!await userExists(userId)) {
      return c.json({ error: "User not found" }, STATUS_CODE.NotFound);
    }

    // Neutral on purpose: it does not say who blocked whom, only that this cannot happen.
    // A ban refuses contact the same way, and answers the same neutral refusal: an inviter
    // must not learn that a moderation action was taken against somebody else.
    if (
      await BlockService.isBlockedBetween(user.id, userId) ||
      await BanService.isBanned(userId)
    ) {
      return c.json(
        { error: "Contact is not possible" },
        STATUS_CODE.Forbidden,
      );
    }

    const invitation = await UserInWritingGroupService.insertInvitation(
      groupId,
      userId,
      role,
      user.id,
    );

    if (invitation === undefined) {
      return c.json(
        { error: "The user is already invited to or a member of the group" },
        STATUS_CODE.Conflict,
      );
    }

    return c.json(invitation, STATUS_CODE.Created);
  },
);
