import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { UserService } from "@/src/service/user_service.ts";
import authenticated from "@/src/middleware/authenticated_allowing_unverified_email_address.ts";
import { SessionCookieService } from "@/src/service/session_cookie_service.ts";
import {
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/logout",
    tags: [AUTH_TAG],
    summary: "Log the current user out and end the session",
    description:
      "Ends the session the request was made with and clears its cookie. Other sessions of the same user are left alone.",
    operationId: "logoutUser",
    middleware: authenticated,
    responses: {
      [STATUS_CODE.OK]: {
        description: "User logged out",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const sessionCookie = SessionCookieService.getUserSession(c);
    if (sessionCookie === undefined) {
      return c.json(
        { error: "No session cookie found" },
        STATUS_CODE.Unauthorized,
      );
    }

    SessionCookieService.deleteUserSession(c);

    await UserService.deleteSession(sessionCookie);

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
