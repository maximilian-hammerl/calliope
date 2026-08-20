import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import { AccountDeletionService } from "@/src/service/account_deletion_service.ts";
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
    summary: "Delete the account for good",
    description:
      "Spends the token from the mailed link, which is what actually deletes the account. Needs no session of its own, and would not survive using one: the account and every session it had are gone when this returns.",
    operationId: "confirmAccountDeletion",
    request: { body: { required: true, content: jsonContent(CONFIRM_BODY) } },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The account is deleted",
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

    const result = await AccountDeletionService.confirmAccountDeletion(token);

    switch (result) {
      case "deleted":
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
