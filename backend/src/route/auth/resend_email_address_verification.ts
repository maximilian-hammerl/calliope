import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated_allowing_unverified_email_address.ts";
import { EmailAddressVerificationService } from "@/src/service/email_address_verification_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/resend-email-address-verification",
    tags: [AUTH_TAG],
    summary: "Send the verification link again",
    description:
      "Reachable without a verified address, since it is how one is obtained. Answers the same way whether a message was sent or the resend cooldown swallowed it, and does nothing at all when the address is already verified.",
    operationId: "resendEmailAddressVerification",
    middleware: authenticated,
    responses: {
      [STATUS_CODE.OK]: {
        description: "Request accepted, whether or not a message was sent",
        content: jsonContent(OK_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  (c) => {
    const user = c.get("user");

    if (user.emailAddressVerifiedAt === null) {
      EmailAddressVerificationService.sendVerificationMail(user);
    }

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
