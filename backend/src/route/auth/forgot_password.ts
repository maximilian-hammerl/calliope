import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { PasswordResetService } from "@/src/service/password_reset_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

const FORGOT_PASSWORD_BODY = z.object({
  // Either identifier, exactly as the login route accepts them: somebody who cannot sign in
  // is unlikely to be sure which of the two they used.
  login: z.string().min(1).max(TEXT_LIMIT.emailAddress),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/forgot-password",
    tags: [AUTH_TAG],
    summary: "Request a password reset link",
    description:
      "Sends a link that sets a new password to the account's e-mail address. Takes a username or an e-mail address, like the login endpoint. Answers the same way whether or not an account matches, so it cannot be used to find out who is registered, and does the work after responding so the timing cannot either.",
    operationId: "requestPasswordReset",
    request: {
      body: { required: true, content: jsonContent(FORGOT_PASSWORD_BODY) },
    },
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
    const { login } = c.req.valid("json");

    // Deliberately not awaited: see `util/background.ts`. Everything, including whether an
    // account matches at all, is decided after the response has gone.
    PasswordResetService.requestPasswordReset(login);

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
