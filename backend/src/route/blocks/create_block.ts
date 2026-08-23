import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { BLOCKS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { BlockService } from "@/src/service/block_service.ts";
import { userExists } from "@/src/service/user_in_writing_group_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";
import { USER_SCHEMA } from "@/src/database/schema.ts";

const CREATE_BLOCK_BODY = z.object({ userId: USER_SCHEMA.shape.id });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [BLOCKS_TAG],
    summary: "Refuse contact from a member",
    description:
      "Neither member can invite the other afterwards, in either direction, and any invitation between them that is still unanswered is withdrawn. Nothing already shared is touched: a group or chat they are both in stays, and is left by leaving it. Blocking somebody already blocked changes nothing.",
    operationId: "blockMember",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(CREATE_BLOCK_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "Contact from this member is refused",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such member",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const { userId } = c.req.valid("json");

    // The database refuses this too; answering here says which mistake it was.
    if (userId === user.id) {
      return c.json({ error: "Cannot block yourself" }, STATUS_CODE.Forbidden);
    }
    if (!await userExists(userId)) {
      return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
    }

    await BlockService.insertBlock(user.id, userId);

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
