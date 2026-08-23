import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { BLOCKS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { BlockService } from "@/src/service/block_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";
import { USER_SCHEMA } from "@/src/database/schema.ts";

const BLOCK_PARAMS = z.object({ userId: USER_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [BLOCKS_TAG],
    summary: "Allow contact from a member again",
    description:
      "Withdraws this member's own block. Invitations withdrawn when it was made are not restored — they were somebody's decision to make again.",
    operationId: "unblockMember",
    middleware: authenticated,
    request: { params: BLOCK_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "Contact is allowed again",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "This member is not blocked",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const removed = await BlockService.deleteBlock(
      c.get("user").id,
      c.req.valid("param").userId,
    );

    if (!removed) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
