import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { USER_SCHEMA } from "@/src/database/schema.ts";
import requireSession from "@/src/middleware/require_session.ts";
import {
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/response.ts";

const CURRENT_USER_RESPONSE = USER_SCHEMA.pick({
  id: true,
  username: true,
  emailAddress: true,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "get",
    path: "/me",
    tags: [AUTH_TAG],
    summary: "Read the currently signed-in user",
    description:
      "Reports who the session cookie belongs to. The session cookie is httpOnly, so this is the only way for a client to find out whether it is signed in and as whom.",
    operationId: "getCurrentUser",
    middleware: requireSession,
    responses: {
      [STATUS_CODE.OK]: {
        description: "The signed-in user",
        content: jsonContent(CURRENT_USER_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...COMMON_RESPONSES,
    },
  }),
  (c) => c.json(c.get("user"), STATUS_CODE.OK),
);
