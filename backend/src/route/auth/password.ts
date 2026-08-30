import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT, TEXT_MINIMUM } from "@/src/text_limit.ts";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { BreachedPasswordService } from "@/src/service/breached_password_service.ts";
import authenticated from "@/src/middleware/authenticated.ts";
import { PasswordChangeService } from "@/src/service/password_change_service.ts";
import { SessionCookieService } from "@/src/service/session_cookie_service.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  INVALID_CREDENTIALS_BODY,
  jsonContent,
  OK_RESPONSE,
  PASSWORD_BREACHED_BODY,
} from "@/src/http/response.ts";

const CHANGE_PASSWORD_BODY = z.object({
  currentPassword: z.string().min(1).max(TEXT_LIMIT.password),
  // The bound register applies, so a password that could be signed up with can be moved to.
  newPassword: z.string().min(TEXT_MINIMUM.password).max(TEXT_LIMIT.password),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "patch",
    path: "/password",
    tags: [AUTH_TAG],
    summary: "Change the password while signed in",
    description:
      "Requires the current password, so a session that was not the member's cannot lock them out of their own account. Every other session ends and any outstanding reset link stops working; this session survives.",
    operationId: "changePassword",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(CHANGE_PASSWORD_BODY) },
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
      [STATUS_CODE.Unauthorized]: {
        description: "The current password is wrong",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { currentPassword, newPassword } = c.req.valid("json");

    // Read rather than passed down: the service needs to know which session to spare, and the
    // cookie is the only place that says which one is asking.
    const session = SessionCookieService.getUserSession(c);

    if (session === undefined) {
      return c.json({ error: "Unauthorized" }, STATUS_CODE.Unauthorized);
    }

    if (await BreachedPasswordService.isBreached(newPassword)) {
      return c.json(PASSWORD_BREACHED_BODY, STATUS_CODE.UnprocessableEntity);
    }

    const result = await PasswordChangeService.changePassword(
      c.get("user").id,
      session.id,
      currentPassword,
      newPassword,
    );

    switch (result) {
      case "changed":
        return c.json({ ok: true } as const, STATUS_CODE.OK);
      case "wrong_password":
        return c.json(INVALID_CREDENTIALS_BODY, STATUS_CODE.Unauthorized);
      default:
        return assertUnreachable(result);
    }
  },
);
