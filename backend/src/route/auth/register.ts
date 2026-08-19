import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT, TEXT_MINIMUM } from "@/src/text_limit.ts";
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
} from "@/src/http/response.ts";

const REGISTER_BODY = USER_SCHEMA
  .pick({ username: true, emailAddress: true })
  .extend({
    username: USER_SCHEMA.shape.username
      .min(TEXT_MINIMUM.username)
      .max(TEXT_LIMIT.username),
    // The column is only text; the address itself is validated here, and normalised so
    // the UNIQUE constraint cannot be bypassed by changing the case.
    //
    // The HTML5 pattern is the one browsers apply to input[type=email], so the form and this
    // schema agree exactly and no address can pass the client only to be refused here. It is
    // deliberately more permissive than Zod's default — `a@b` and `alice@localhost` are
    // accepted — which is the price of that agreement while nothing verifies the address.
    emailAddress: z.email({ pattern: z.regexes.html5Email })
      .max(TEXT_LIMIT.emailAddress)
      .toLowerCase(),
    // Never stored as given, so it has no column of its own.
    password: z.string().min(1).max(TEXT_LIMIT.password),
  });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/register",
    tags: [AUTH_TAG],
    summary: "Register a user and start a session",
    description:
      "Creates a user and immediately starts a session for them. The username and the email address must both be unused; the address is compared case-insensitively.",
    operationId: "registerUser",
    request: {
      body: { required: true, content: jsonContent(REGISTER_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "User registered",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Conflict]: {
        description: "Username or email address already in use",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { username, password, emailAddress } = c.req.valid("json");

    const user = await UserService.insertUser(username, password, emailAddress);

    if (user === undefined) {
      return c.json(
        { error: "Username or email address already in use" },
        STATUS_CODE.Conflict,
      );
    }

    const sessionToken = await UserService.insertSessionForUser(user);
    SessionCookieService.setUserSession(c, sessionToken);

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
