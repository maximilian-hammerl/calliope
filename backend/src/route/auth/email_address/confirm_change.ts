import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { EmailAddressChangeService } from "@/src/service/email_address_change_service.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

const CONFIRM_BODY = z.object({ token: z.string().min(1) });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [AUTH_TAG],
    summary: "Apply a requested email address change",
    description:
      "Spends the token from the link sent to the new address, which is what actually moves the account. Every session ends, including the one that asked. Needs no session of its own: the link is usually opened in the new address's mailbox, on whatever device that happens to be.",
    operationId: "confirmEmailAddressChange",
    request: { body: { required: true, content: jsonContent(CONFIRM_BODY) } },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The account now uses the new address",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Conflict]: {
        description:
          "Another account took this address while the link was outstanding",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Gone]: {
        description: "The link is unknown, already used, cancelled, or expired",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { token } = c.req.valid("json");

    const result = await EmailAddressChangeService.confirmEmailAddressChange(
      token,
    );

    switch (result) {
      case "changed":
        return c.json({ ok: true } as const, STATUS_CODE.OK);
      case "in_use":
        return c.json(
          { error: "Another account already uses this address" },
          STATUS_CODE.Conflict,
        );
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
