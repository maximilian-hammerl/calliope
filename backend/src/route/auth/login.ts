import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { UserService } from "@/src/service/user_service.ts";
import { SessionCookieService } from "@/src/service/session_cookie_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/response.ts";

const LOGIN_BODY = z.object({
  // Either identifier is accepted, so a member need not remember which they signed up with,
  // and the bound is the longer of the two.
  login: z.string().min(1).max(TEXT_LIMIT.emailAddress),
  password: z.string().min(1).max(TEXT_LIMIT.password),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/login",
    tags: [AUTH_TAG],
    summary: "Log a user in and start a session",
    description:
      "Exchanges a username or e-mail address and password for a session cookie. Answers the same way whether the username, e-mail address or the password was wrong.",
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
    const { login: usernameOrEmailAddress, password } = c.req.valid("json");

    const user = await UserService.selectUser(usernameOrEmailAddress, password);

    if (user === undefined) {
      return c.json({ error: "Invalid credentials" }, STATUS_CODE.Unauthorized);
    }

    const sessionToken = await UserService.insertSessionForUser(user);
    SessionCookieService.setUserSession(c, sessionToken);

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
