import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { listQuery } from "@/src/list/list_endpoint_query.ts";
import { CHAT_GROUP_RESPONSE } from "@/src/http/response_schema.ts";
import { CHATS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { ChatGroupService } from "@/src/service/chat_group_service.ts";
import {
  FAVOURITE_FILTER,
  listQuerySchema,
  listResponseSchema,
} from "@/src/list/list_endpoint.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { CHAT_GROUP_SCHEMA } from "@/src/database/schema.ts";

// Public attribute names are mapped to qualified columns, so the API never exposes the
// schema, and only these values can ever reach `dynamic.ref`.
const SORT_ATTRIBUTE = CHAT_GROUP_SCHEMA
  .keyof()
  .extract(["lastActivityAt", "createdAt", "title"])
  .default("lastActivityAt")
  .transform((attribute) => `chatGroup.${attribute}` as const);

const LIST_CHATS_BODY = listQuerySchema(
  SORT_ATTRIBUTE,
  { favourite: FAVOURITE_FILTER },
  "desc",
);

export default new OpenAPIHono().openapi(
  createRoute({
    method: "query",
    path: "/",
    tags: [CHATS_TAG],
    summary: "List the current user's chats",
    description:
      "Returns a page of the chats the current user belongs to or has been invited to, most recently active first, each with how many messages they have not read.",
    operationId: "listChats",
    middleware: authenticated,
    // Required, so that an absent body cannot skip validation and lose the defaults.
    request: {
      body: { required: true, content: jsonContent(LIST_CHATS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of chats",
        content: jsonContent(listResponseSchema(CHAT_GROUP_RESPONSE)),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...FORBIDDEN_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const page = await ChatGroupService.listChatGroups(
      c.get("user"),
      listQuery(c.req.valid("json")),
    );

    return c.json(page, STATUS_CODE.OK);
  },
);
