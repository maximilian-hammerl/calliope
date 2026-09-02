import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { THREADS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
import { WritingThreadService } from "@/src/service/writing_thread_service.ts";
import { mayAct } from "@/src/service/writing_group_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";
import {
  WRITING_GROUP_SCHEMA,
  WRITING_THREAD_SCHEMA,
} from "@/src/database/schema.ts";

const THREAD_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  threadId: WRITING_THREAD_SCHEMA.shape.id,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [THREADS_TAG],
    summary: "Delete a thread the current user wrote or administers",
    description:
      "Deletes a thread and every post in it. Only the member who started it, or an administrator of the group, may delete it.",
    operationId: "deleteThread",
    middleware: authenticated,
    request: { params: THREAD_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The thread and its posts were deleted",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only the author or an administrator may delete it",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group or thread, or the user is not a member",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId, threadId } = c.req.valid("param");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const thread = await WritingThreadService.selectThread(groupId, threadId);
    if (thread === undefined) {
      return c.json({ error: "Thread not found" }, STATUS_CODE.NotFound);
    }

    if (
      !mayAct(role, "thread:delete", {
        createdBy: thread.createdBy,
        userId: user.id,
      })
    ) {
      return c.json(
        { error: "Only the author or an administrator can delete a thread" },
        STATUS_CODE.Forbidden,
      );
    }

    // Posts go with it through the foreign key's cascade.
    await WritingThreadService.deleteThread(threadId);

    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
