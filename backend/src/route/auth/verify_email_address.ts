import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { EmailAddressVerificationService } from "@/src/service/email_address_verification_service.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

const VERIFY_EMAIL_ADDRESS_BODY = z.object({ token: z.string().min(1) });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/verify-email-address",
    tags: [AUTH_TAG],
    summary: "Confirm an email address with a verification token",
    description:
      "Spends the token from a verification link. Deliberately needs no session: the link is often opened in a different browser from the one that registered. No session is started either, for the same reason.",
    operationId: "verifyEmailAddress",
    request: {
      body: { required: true, content: jsonContent(VERIFY_EMAIL_ADDRESS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "Email address confirmed",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Gone]: {
        description: "The link is unknown, already used, or expired",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { token } = c.req.valid("json");

    const result = await EmailAddressVerificationService.verifyEmailAddress(
      token,
    );

    switch (result) {
      case "verified":
        return c.json({ ok: true } as const, STATUS_CODE.OK);
      case "invalid_token":
        return c.json(
          { error: "The link is no longer valid" },
          STATUS_CODE.Gone,
        );
      default:
        return assertUnreachable(result);
    }
  },
);
