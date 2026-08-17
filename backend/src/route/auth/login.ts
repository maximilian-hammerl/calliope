import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { UserService } from "@/src/service/user_service.ts";
import { USER_SCHEMA } from "@/src/database/schema.ts";
import { SessionCookieService } from "@/src/service/session_cookie_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/response.ts";

const LOGIN_BODY = USER_SCHEMA
  .pick({ username: true })
  .extend({
    username: USER_SCHEMA.shape.username.min(1),
    // Never stored as given, so it has no column of its own.
    password: z.string().min(1),
  });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/login",
    tags: [AUTH_TAG],
    summary: "Log a user in and start a session",
    description:
      "Exchanges a username and password for a session cookie. Answers the same way whether the username or the password was wrong.",
    operationId: "loginUser",
    request: {
      body: { required: true, content: jsonContent(LOGIN_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "User logged in",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "Invalid credentials",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { username, password } = c.req.valid("json");

    const user = await UserService.selectUser(username, password);

    if (user === undefined) {
      return c.json({ error: "Invalid credentials" }, STATUS_CODE.Unauthorized);
    }

    const sessionToken = await UserService.insertSessionForUser(user);
    SessionCookieService.setUserSession(c, sessionToken);

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
