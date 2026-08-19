import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
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

/**
 * Which groups, relative to the caller. The default is `joined`, because the list this backs
 * is "Meine Gruppen" and a group somebody merely may read is not theirs. `none` is the
 * discovery list, `any` the older behaviour of everything they are allowed to see.
 */
const MEMBERSHIP = z
  .enum(["joined", "invited", "none", "any"])
  .default("joined")
  .meta({
    description:
      "Which groups relative to the caller: ones they have joined, ones they have been invited to, public ones they are not in, or everything they may see.",
  });

const LIST_GROUPS_BODY = listQuerySchema(
  SORT_ATTRIBUTE,
  { membership: MEMBERSHIP },
  "desc",
);

export default new OpenAPIHono().openapi(
  createRoute({
    // QUERY is safe and idempotent like GET, but carries its parameters in a body.
    method: "query",
    path: "/",
    tags: [GROUPS_TAG],
    summary: "List groups, by default the current user's own",
    description:
      "Returns a page of groups, by default the ones the current user has joined. The membership filter selects invitations, public groups they are not in, or everything they may see instead.",
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
