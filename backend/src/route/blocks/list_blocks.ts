import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { listQuery } from "@/src/list/list_endpoint_query.ts";
import { BLOCKS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { BlockService } from "@/src/service/block_service.ts";
import {
  listQuerySchema,
  listResponseSchema,
} from "@/src/list/list_endpoint.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";
import { USER_SCHEMA } from "@/src/database/schema.ts";

const BLOCK_RESPONSE = z.object({
  blockedId: USER_SCHEMA.shape.id,
  username: USER_SCHEMA.shape.username,
  createdAt: z.string(),
});

// Newest first: the list is read to undo a block, and the one just made is the likely target.
const SORT_ATTRIBUTE = z
  .enum(["createdAt"])
  .default("createdAt")
  .transform((attribute) => `userBlock.${attribute}` as const);

const LIST_BLOCKS_BODY = listQuerySchema(SORT_ATTRIBUTE, {}, "desc");

export default new OpenAPIHono().openapi(
  createRoute({
    method: "query",
    path: "/",
    tags: [BLOCKS_TAG],
    summary: "List the members whose contact this member refuses",
    description:
      "Only the current user's own blocks; nobody can read whether somebody else blocked them.",
    operationId: "listBlocks",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(LIST_BLOCKS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of blocked members",
        content: jsonContent(listResponseSchema(BLOCK_RESPONSE)),
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
    const page = await BlockService.listBlocks(
      c.get("user").id,
      listQuery(c.req.valid("json")),
    );
    return c.json(page, STATUS_CODE.OK);
  },
);
