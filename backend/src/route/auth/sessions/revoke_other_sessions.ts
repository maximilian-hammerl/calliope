import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { SessionCookieService } from "@/src/service/session_cookie_service.ts";
import { UserService } from "@/src/service/user_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [AUTH_TAG],
    summary: "End every session but this one",
    description:
      "Signs the member out everywhere else and leaves the session asking alone — signing somebody out of the tab they are working in punishes good hygiene. No password: this is the defensive act, and asking for one blocks the case it exists for.",
    operationId: "revokeOtherSessions",
    middleware: authenticated,
    responses: {
      [STATUS_CODE.OK]: {
        description: "The other sessions were ended",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const currentSessionId = SessionCookieService.getUserSession(c)?.id;

    // Without a readable cookie there is no session to spare, and ending every one of them
    // would sign the member out of the tab they are asking from.
    if (currentSessionId === undefined) {
      return c.json({ error: "Unauthorized" }, STATUS_CODE.Unauthorized);
    }

    await UserService.deleteOtherSessions(c.get("user").id, currentSessionId);

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
