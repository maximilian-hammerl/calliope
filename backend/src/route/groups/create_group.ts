import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
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

const CREATE_GROUP_BODY = WRITING_GROUP_SCHEMA
  .pick({ title: true, description: true, visibility: true })
  .extend({
    // The column only requires text; an empty title is not useful.
    title: WRITING_GROUP_SCHEMA.shape.title.min(1),
    // Private unless asked otherwise, per the "private by default" principle.
    visibility: WRITING_GROUP_SCHEMA.shape.visibility.default("private"),
  });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [GROUPS_TAG],
    summary: "Create a group, with the creating user as its administrator",
    description:
      "Creates a writing group and joins the creating user to it as its administrator. Groups are private unless the request asks for a public one.",
    operationId: "createGroup",
    middleware: requireSession,
    request: {
      body: { required: true, content: jsonContent(CREATE_GROUP_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "Group created",
        content: jsonContent(WRITING_GROUP_SCHEMA),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { title, description, visibility } = c.req.valid("json");

    const writingGroup = await WritingGroupService.insertWritingGroup(
      c.get("user"),
      title,
      description,
      visibility,
    );

    return c.json(writingGroup, STATUS_CODE.Created);
  },
);
