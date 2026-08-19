import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { GROUP_RESPONSE } from "@/src/http/response_schema.ts";
import { GROUPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import {
  listQuerySchema,
  listResponseSchema,
} from "@/src/list/list_endpoint.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { WRITING_GROUP_SCHEMA } from "@/src/database/schema.ts";

// Public attribute names are mapped to qualified columns, so the API never exposes the
// schema, and only these values can ever reach `dynamic.ref`.
const SORT_ATTRIBUTE = WRITING_GROUP_SCHEMA
  .keyof()
  .extract(["createdAt", "lastActivityAt", "title"])
  .default("createdAt")
  .transform((attribute) => `writingGroup.${attribute}` as const);

const LIST_GROUPS_BODY = listQuerySchema(SORT_ATTRIBUTE, {}, "desc");

export default new OpenAPIHono().openapi(
  createRoute({
    // QUERY is safe and idempotent like GET, but carries its parameters in a body.
    method: "query",
    path: "/",
    tags: [GROUPS_TAG],
    summary: "List the groups visible to the current user",
    description:
      "Returns a page of the groups the current user may see: every public group, plus the private ones they belong to.",
    operationId: "listGroups",
    middleware: requireSession,
    // Required, so that an absent body cannot skip validation and lose the defaults.
    request: {
      body: { required: true, content: jsonContent(LIST_GROUPS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of groups",
        content: jsonContent(listResponseSchema(GROUP_RESPONSE)),
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
    const page = await WritingGroupService.listVisibleWritingGroups(
      c.get("user"),
      c.req.valid("json"),
    );

    return c.json(page, STATUS_CODE.OK);
  },
);
