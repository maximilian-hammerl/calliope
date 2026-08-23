import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { AUTH_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated_allowing_unverified_email_address.ts";
import { AccountDeletionService } from "@/src/service/account_deletion_service.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  INVALID_CREDENTIALS_BODY,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

const REQUEST_DELETION_BODY = z.object({
  // Re-authentication, as for changing the address: a session alone must not be able to end
  // an account.
  password: z.string().min(1).max(TEXT_LIMIT.password),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [AUTH_TAG],
    summary: "Ask to delete the account",
    description:
      "Requires the current password. Deletes nothing yet: a link goes to the address on file, and the account lives until that link is opened. Reachable with an unverified address: somebody who mistyped theirs must still be able to leave.",
    operationId: "requestAccountDeletion",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(REQUEST_DELETION_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description:
          "Deletion requested, and a link sent to the address on file",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "The password is wrong",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { password } = c.req.valid("json");

    const result = await AccountDeletionService.requestAccountDeletion(
      c.get("user").id,
      password,
    );

    switch (result) {
      case "requested":
        return c.json({ ok: true } as const, STATUS_CODE.OK);
      case "wrong_password":
        return c.json(INVALID_CREDENTIALS_BODY, STATUS_CODE.Unauthorized);
      default:
        return assertUnreachable(result);
    }
  },
);
