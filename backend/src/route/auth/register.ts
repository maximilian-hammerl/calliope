import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT, TEXT_MINIMUM } from "@/src/text_limit.ts";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { UserService } from "@/src/service/user_service.ts";
import { sessionProvenance } from "@/src/util/session_provenance.ts";
import { USER_SCHEMA } from "@/src/database/schema.ts";
import { SessionCookieService } from "@/src/service/session_cookie_service.ts";
import { EmailAddressVerificationService } from "@/src/service/email_address_verification_service.ts";
import { EMAIL_ADDRESS_SCHEMA } from "@/src/http/request_schema.ts";
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
    emailAddress: EMAIL_ADDRESS_SCHEMA,
    // Never stored as given, so it has no column of its own.
    password: z.string().min(TEXT_MINIMUM.password).max(TEXT_LIMIT.password),
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

    // A session is started even though the address is unverified: without one there is no
    // way back in to correct a typo, and the account would be orphaned by a single slip.
    const sessionToken = await UserService.insertSessionForUser(
      user,
      sessionProvenance(c),
    );
    SessionCookieService.setUserSession(c, sessionToken);

    EmailAddressVerificationService.sendVerificationMail(user);

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
