import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { GROUP_RESPONSE } from "@/src/http/response_schema.ts";
import { GROUPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
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
    method: "get",
    path: "/",
    tags: [GROUPS_TAG],
    summary: "Fetch a public group, or a private one the user belongs to",
    description:
      "Returns a single group. A private group the current user does not belong to is reported as missing rather than forbidden, so that its existence stays hidden.",
    operationId: "getGroup",
    middleware: authenticated,
    request: { params: GROUP_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The group",
        content: jsonContent(GROUP_RESPONSE),
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
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId } = c.req.valid("param");

    const writingGroup = await WritingGroupService.selectWritingGroupForReader(
      c.get("user"),
      groupId,
    );

    // A private group the user cannot see is reported as missing, so that its
    // existence does not leak.
    if (writingGroup === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    return c.json(writingGroup, STATUS_CODE.OK);
  },
);
