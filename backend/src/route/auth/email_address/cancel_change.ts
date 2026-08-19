import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { EmailAddressChangeService } from "@/src/service/email_address_change_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

const CANCEL_BODY = z.object({ token: z.string().min(1) });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [AUTH_TAG],
    summary: "Call off a requested email address change",
    description:
      "The link from the notice sent to the address being moved away from. Needs no session, deliberately: the person who should be able to stop this is whoever reads that mailbox, and in the case worth defending against they are not the one holding the session.",
    operationId: "cancelEmailAddressChange",
    request: { body: { required: true, content: jsonContent(CANCEL_BODY) } },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The request is called off",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Gone]: {
        description: "Nothing outstanding matches this link",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { token } = c.req.valid("json");

    const cancelled = await EmailAddressChangeService.cancelEmailAddressChange(
      token,
    );

    return cancelled
      ? c.json({ ok: true } as const, STATUS_CODE.OK)
      : c.json({ error: "The link is no longer valid" }, STATUS_CODE.Gone);
  },
);
