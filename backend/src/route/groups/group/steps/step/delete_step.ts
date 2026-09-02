import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { STEPS_TAG } from "@/src/open_api_specification.ts";
import { STATUS_CODE } from "@std/http/status";
import authenticated from "@/src/middleware/authenticated.ts";
import { WritingGroupService } from "@/src/service/writing_group_service.ts";
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
    middleware: authenticated,
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
    const { groupId, stepId } = c.req.valid("param");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    const step = await WritingGroupNextStepService.selectStep(stepId);
    if (step === undefined || step.writingGroupId !== groupId) {
      return c.json({ error: "Step not found" }, STATUS_CODE.NotFound);
    }

    if (
      !mayAct(role, "step:delete", {
        createdBy: step.createdBy,
        userId: user.id,
      })
    ) {
      return c.json(
        { error: "Only the creator or an administrator may delete it" },
        STATUS_CODE.Forbidden,
      );
    }

    await WritingGroupNextStepService.deleteStep(stepId);
    return c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
