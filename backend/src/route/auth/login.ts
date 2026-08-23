import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { UserService } from "@/src/service/user_service.ts";
import { sessionProvenance } from "@/src/util/session_provenance.ts";
import { SessionCookieService } from "@/src/service/session_cookie_service.ts";
import {
  ACCOUNT_BANNED_BODY,
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  INVALID_CREDENTIALS_BODY,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

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
      [STATUS_CODE.Forbidden]: {
        description:
          "The credentials were right and the account is banned. Answered only after the password verifies, so it discloses nothing to somebody guessing.",
        content: jsonContent(ERROR_RESPONSE),
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
      return c.json(INVALID_CREDENTIALS_BODY, STATUS_CODE.Unauthorized);
    }

    // Only after the password has verified, which is what makes saying so safe: whoever sees
    // this could already prove the account exists. A wrong password still gets the answer
    // above, so the address is never confirmed to somebody guessing.
    if (user.bannedAt !== null) {
      return c.json(ACCOUNT_BANNED_BODY, STATUS_CODE.Forbidden);
    }

    const sessionToken = await UserService.insertSessionForUser(
      user,
      sessionProvenance(c),
    );
    SessionCookieService.setUserSession(c, sessionToken);

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
