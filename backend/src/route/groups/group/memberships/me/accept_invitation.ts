import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { MEMBERSHIP_RESPONSE } from "@/src/http/response_schema.ts";
import { MEMBERSHIPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { UserInWritingGroupService } from "@/src/service/user_in_writing_group_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { WRITING_GROUP_SCHEMA } from "@/src/database/schema.ts";

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [MEMBERSHIPS_TAG],
    summary: "Accept the current user's invitation to a group",
    description:
      "Turns the current user's invitation into a membership. Only the invited user can accept, and only once.",
    operationId: "acceptInvitation",
    // Addressed as `me`, because an invitation can only ever be accepted by its invitee.
    middleware: authenticated,
    request: { params: GROUP_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The invitation was accepted",
        content: jsonContent(MEMBERSHIP_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "The current user has no invitation to this group",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Conflict]: {
        description: "The invitation has already been accepted",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId } = c.req.valid("param");
    const user = c.get("user");

    const accepted = await UserInWritingGroupService.acceptInvitation(
      groupId,
      user.id,
    );

    if (accepted !== undefined) {
      return c.json(accepted, STATUS_CODE.OK);
    }

    // Nothing was updated: either there is no membership, or it is already joined.
    const membership = await UserInWritingGroupService.selectMembership(
      groupId,
      user.id,
    );

    if (membership === undefined) {
      return c.json({ error: "Invitation not found" }, STATUS_CODE.NotFound);
    }

    return c.json(
      { error: "The invitation has already been accepted" },
      STATUS_CODE.Conflict,
    );
  },
);
