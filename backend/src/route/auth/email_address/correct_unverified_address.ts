import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated_allowing_unverified_email_address.ts";
import { EmailAddressVerificationService } from "@/src/service/email_address_verification_service.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";
import { EMAIL_ADDRESS_SCHEMA } from "@/src/http/request_schema.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

const CHANGE_EMAIL_ADDRESS_BODY = z.object({
  emailAddress: EMAIL_ADDRESS_SCHEMA,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: [AUTH_TAG],
    summary: "Correct an address that has not been verified yet",
    description:
      "The escape hatch for an address mistyped at registration, which would otherwise orphan the account. Refuses once the address has been verified: changing a proven address has to notify the old one and offer an undo, or a stolen session could move the account to another inbox.",
    operationId: "changeEmailAddress",
    middleware: authenticated,
    request: {
      body: {
        required: true,
        content: jsonContent(CHANGE_EMAIL_ADDRESS_BODY),
      },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "Address changed, and a new link sent to it",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description:
          "The address is already verified and cannot be changed here",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Conflict]: {
        description: "Another account already uses this address",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { emailAddress } = c.req.valid("json");
    const user = c.get("user");

    const result = await EmailAddressVerificationService
      .changeUnverifiedEmailAddress(
        user.id,
        emailAddress,
      );

    switch (result) {
      case "changed":
        return c.json({ ok: true } as const, STATUS_CODE.OK);
      case "already_verified":
        return c.json(
          { error: "This address has already been verified" },
          STATUS_CODE.Forbidden,
        );
      case "in_use":
        return c.json(
          { error: "Another account already uses this address" },
          STATUS_CODE.Conflict,
        );
      default:
        return assertUnreachable(result);
    }
  },
);
