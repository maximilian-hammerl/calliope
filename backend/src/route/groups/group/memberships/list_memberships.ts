import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { MEMBERSHIP_RESPONSE } from "@/src/response_schema.ts";
import { MEMBERSHIPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { UserInWritingGroupService } from "@/src/service/user_in_writing_group_service.ts";
import { listQuerySchema, listResponseSchema } from "@/src/list_endpoint.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/response.ts";
import {
  USER_IN_WRITING_GROUP_SCHEMA,
  WRITING_GROUP_SCHEMA,
} from "@/src/database/schema.ts";

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

const SORT_ATTRIBUTE = USER_IN_WRITING_GROUP_SCHEMA
  .keyof()
  .extract(["createdAt", "updatedAt", "role", "status"])
  .default("createdAt")
  .transform((attribute) => `userInWritingGroup.${attribute}` as const);

const LIST_MEMBERSHIPS_BODY = listQuerySchema(SORT_ATTRIBUTE, {}, "asc");

export default new OpenAPIHono().openapi(
  createRoute({
    method: "query",
    path: "/",
    tags: [MEMBERSHIPS_TAG],
    summary: "List the memberships and invitations of a group",
    description:
      "Returns a page of the group's memberships, including invitations that have not been accepted yet.",
    operationId: "listMemberships",
    middleware: requireSession,
    request: {
      params: GROUP_PARAMS,
      body: { required: true, content: jsonContent(LIST_MEMBERSHIPS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of memberships",
        content: jsonContent(listResponseSchema(MEMBERSHIP_RESPONSE)),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
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

    const writingGroup = await WritingGroupService.selectVisibleWritingGroup(
      c.get("user"),
      groupId,
    );
    if (writingGroup === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const page = await UserInWritingGroupService.listMemberships(
      groupId,
      c.req.valid("json"),
    );

    return c.json(page, STATUS_CODE.OK);
  },
);
