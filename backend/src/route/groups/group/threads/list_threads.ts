import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { THREAD_RESPONSE } from "@/src/response_schema.ts";
import { THREADS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import requireSession from "@/src/middleware/require_session.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingThreadService } from "@/src/service/writing_thread_service.ts";
import { listQuerySchema, listResponseSchema } from "@/src/list_endpoint.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/response.ts";
import {
  WRITING_GROUP_SCHEMA,
  WRITING_THREAD_SCHEMA,
} from "@/src/database/schema.ts";

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

const SORT_ATTRIBUTE = WRITING_THREAD_SCHEMA
  .keyof()
  .extract(["createdAt", "updatedAt", "lastActivityAt", "title"])
  .default("createdAt")
  .transform((attribute) => `thread.${attribute}` as const);

const LIST_THREADS_BODY = listQuerySchema(SORT_ATTRIBUTE, {}, "desc");

export default new OpenAPIHono().openapi(
  createRoute({
    method: "query",
    path: "/",
    tags: [THREADS_TAG],
    summary: "List the threads of a group the current user belongs to",
    description:
      "Returns a page of the group's threads. Readable by any joined member, whatever their role, and by nobody else.",
    operationId: "listThreads",
    middleware: requireSession,
    request: {
      params: GROUP_PARAMS,
      body: { required: true, content: jsonContent(LIST_THREADS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "A page of threads",
        content: jsonContent(listResponseSchema(THREAD_RESPONSE)),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group, or the user is not a member of it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId } = c.req.valid("param");

    // Any role may read, but only members.
    const role = await WritingGroupService.selectRoleForUser(
      c.get("user"),
      groupId,
    );
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const page = await WritingThreadService.listThreads(
      groupId,
      c.req.valid("json"),
    );

    return c.json(page, STATUS_CODE.OK);
  },
);
