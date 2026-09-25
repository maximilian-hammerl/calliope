import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { db } from "@/src/database/client.ts";
import { STEPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { joinedGroup, stepInGroup } from "@/src/scope/group_scope.ts";
import { WritingGroupNextStepService } from "@/src/service/writing_group_next_step_service.ts";
import { mayAct } from "@/src/service/writing_group_authorization.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";
import {
  WRITING_GROUP_NEXT_STEP_SCHEMA,
  WRITING_GROUP_SCHEMA,
} from "@/src/database/schema.ts";

const STEP_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  stepId: WRITING_GROUP_NEXT_STEP_SCHEMA.shape.id,
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "delete",
    path: "/",
    tags: [STEPS_TAG],
    summary: "Delete a step the current user created or administers",
    description:
      "Completed steps are never removed on their own; this is the only way one leaves.",
    operationId: "deleteStep",
    middleware: [authenticated, joinedGroup, stepInGroup] as const,
    request: { params: STEP_PARAMS },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The step was deleted",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only the creator or an administrator may delete it",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group or step, or the group is not the user's",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const user = c.get("user");
    const step = c.get("step");

    if (
      !mayAct(c.get("group").role, "step:delete", {
        createdBy: step.createdBy,
        userId: user.id,
      })
    ) {
      return c.json(
        { error: "Only the creator or an administrator may delete it" },
        STATUS_CODE.Forbidden,
      );
    }

    await db.transaction().execute((transaction) =>
      WritingGroupNextStepService.deleteStep(transaction, step.id)
    );
    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
