import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT, TEXT_MINIMUM } from "@/src/text_limit.ts";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { BreachedPasswordService } from "@/src/service/breached_password_service.ts";
import { PasswordResetService } from "@/src/service/password_reset_service.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
  PASSWORD_BREACHED_BODY,
} from "@/src/http/response.ts";

const RESET_PASSWORD_BODY = z.object({
  token: z.string().min(1),
  // The bound register applies, so a password that could be signed up with can also be
  // returned to.
  password: z.string().min(TEXT_MINIMUM.password).max(TEXT_LIMIT.password),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/reset-password",
    tags: [AUTH_TAG],
    summary: "Set a new password with a reset token",
    description:
      "Spends the token from a reset link and sets a new password. The token works once and ends every existing session, so the member signs in again afterwards. No session is started here: the link may have been read by somebody else.",
    operationId: "resetPassword",
    request: {
      body: { required: true, content: jsonContent(RESET_PASSWORD_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "Password changed",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.UnprocessableEntity]: {
        description: "The password appears in known breaches",
        content: jsonContent(ERROR_RESPONSE),
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
    const { token, password } = c.req.valid("json");

    if (await BreachedPasswordService.isBreached(password)) {
      return c.json(PASSWORD_BREACHED_BODY, STATUS_CODE.UnprocessableEntity);
    }

    const result = await PasswordResetService.resetPassword(token, password);

    switch (result) {
      case "reset":
        return c.json({ ok: true } as const, STATUS_CODE.OK);
      // One answer for all three cases: which of them it was is only useful to somebody
      // guessing tokens.
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
