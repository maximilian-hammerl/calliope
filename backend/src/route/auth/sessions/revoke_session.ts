import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { UserService } from "@/src/service/user_service.ts";
import { USER_SESSION_SCHEMA } from "@/src/database/schema.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

const SESSION_PARAMS = z.object({ sessionId: USER_SESSION_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [AUTH_TAG],
    summary: "End one of the member's own sessions",
    description:
      "Scoped to the requesting member, so an id alone cannot end somebody else's session. Ending the session asking is allowed: it is the same as signing out.",
    operationId: "revokeSession",
    middleware: authenticated,
    request: { params: SESSION_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The session was ended",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "The member has no session with this id",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const ended = await UserService.deleteSessionForUser(
      c.get("user").id,
      c.req.valid("param").sessionId,
    );

    // 404 rather than 403: whether somebody else's session has this id is not this member's
    // business either way.
    if (!ended) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
