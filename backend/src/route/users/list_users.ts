import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { USER_RESPONSE } from "@/src/response_schema.ts";
import { USERS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { UserService } from "@/src/service/user_service.ts";
import { listQuerySchema, listResponseSchema } from "@/src/list_endpoint.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/response.ts";
import { USER_SCHEMA } from "@/src/database/schema.ts";

// Public attribute names are mapped to qualified columns, so the API never exposes the
// schema, and only these values can ever reach `dynamic.ref`.
const SORT_ATTRIBUTE = USER_SCHEMA
  .keyof()
  .extract(["username", "createdAt"])
  .default("username")
  .transform((attribute) => `user.${attribute}` as const);

const LIST_USERS_BODY = listQuerySchema(SORT_ATTRIBUTE, {});

export default new OpenAPIHono().openapi(
  createRoute({
    // QUERY is safe and idempotent like GET, but carries its parameters in a body — which
    // also keeps the searched name out of access logs, history and the `Referer` header.
    method: "query",
    path: "/",
    tags: [USERS_TAG],
    summary: "Find members by name",
    description:
      "Returns a page of members, narrowed to those whose username contains the search term when one is given. Only the id and the username are returned, never an email address.",
    operationId: "listUsers",
    middleware: requireSession,
    // Required, so that an absent body cannot skip validation and lose the defaults.
    request: {
      body: { required: true, content: jsonContent(LIST_USERS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of members",
        content: jsonContent(listResponseSchema(USER_RESPONSE)),
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
    const page = await UserService.listUsers(c.req.valid("json"));

    return c.json(page, STATUS_CODE.OK);
  },
);
