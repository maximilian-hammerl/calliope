import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { STATUS_CODE } from "@std/http/status";
import { USERS_TAG } from "@/src/open_api_specification.ts";
import authenticated from "@/src/middleware/authenticated.ts";
import { UserAvatarService } from "@/src/service/user_avatar_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/avatar",
    tags: [USERS_TAG],
    summary: "Remove the member's own picture",
    description:
      "The member falls back to their initials. Idempotent: removing a picture that is not there is the same answer. The stored file is collected later rather than deleted here, so restoring a backup cannot produce a broken picture.",
    operationId: "deleteAvatar",
    middleware: authenticated,
    responses: {
      [STATUS_CODE.OK]: {
        description: "There is no picture",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    await UserAvatarService.deleteAvatar(c.get("user").id);
    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
