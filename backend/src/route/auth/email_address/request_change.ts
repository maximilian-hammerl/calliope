import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { EmailAddressChangeService } from "@/src/service/email_address_change_service.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";
import { EMAIL_ADDRESS_SCHEMA } from "@/src/http/request_schema.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  INVALID_CREDENTIALS_BODY,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

const REQUEST_CHANGE_BODY = z.object({
  emailAddress: EMAIL_ADDRESS_SCHEMA,
  // The current one, not a new one: this is re-authentication, so that a stolen session on
  // its own cannot move the account to somebody else's inbox.
  password: z.string().min(1).max(TEXT_LIMIT.password),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [AUTH_TAG],
    summary: "Ask to move the account to another email address",
    description:
      "Requires the current password. Changes nothing yet: a link goes to the new address, and the account keeps the old one until that link is opened. The old address is told at the same time and can cancel.",
    operationId: "requestEmailAddressChange",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(REQUEST_CHANGE_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "Change requested, and a link sent to the new address",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "The password is wrong",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Conflict]: {
        description: "Another account already uses this address",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { emailAddress, password } = c.req.valid("json");

    const result = await EmailAddressChangeService.requestEmailAddressChange(
      c.get("user").id,
      emailAddress,
      password,
    );

    switch (result) {
      case "requested":
        return c.json({ ok: true } as const, STATUS_CODE.OK);
      case "wrong_password":
        return c.json(INVALID_CREDENTIALS_BODY, STATUS_CODE.Unauthorized);
      case "in_use":
        return c.json(
          { error: "Another account already uses this address" },
          STATUS_CODE.Conflict,
        );
      // Unreachable through this route, which requires a verified session — kept because the
      // service is the thing that guarantees it, not the middleware.
      case "not_verified":
        return c.json(INVALID_CREDENTIALS_BODY, STATUS_CODE.Unauthorized);
      default:
        return assertUnreachable(result);
    }
  },
);
