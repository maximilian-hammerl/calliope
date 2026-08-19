import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { MEMBERSHIPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { UserInWritingGroupService } from "@/src/service/user_in_writing_group_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";
import { WRITING_GROUP_SCHEMA } from "@/src/database/schema.ts";

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [MEMBERSHIPS_TAG],
    summary: "Leave a group, or decline its invitation",
    description:
      "Removes the current user's own membership, which also declines a pending invitation. Leaving as the last member deletes the group.",
    operationId: "leaveGroup",
    // Addressed as `me`, because this only ever removes the current user's own membership.
    middleware: requireSession,
    request: { params: GROUP_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The membership or invitation was removed",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "The current user has no membership in this group",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId } = c.req.valid("param");

    const removed = await UserInWritingGroupService
      .deleteMembership(groupId, c.get("user").id);

    if (!removed) {
      return c.json({ error: "Membership not found" }, STATUS_CODE.NotFound);
    }

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
