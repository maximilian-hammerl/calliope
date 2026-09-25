import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { db } from "@/src/database/client.ts";
import { NEXT_STEP_RESPONSE } from "@/src/http/response_schema.ts";
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
} from "@/src/http/response.ts";
import {
  WRITING_GROUP_NEXT_STEP_SCHEMA,
  WRITING_GROUP_SCHEMA,
} from "@/src/database/schema.ts";

const STEP_PARAMS = z.object({
  groupId: WRITING_GROUP_SCHEMA.shape.id,
  stepId: WRITING_GROUP_NEXT_STEP_SCHEMA.shape.id,
});

const UPDATE_STEP_BODY = z.object({ done: z.boolean() });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: [STEPS_TAG],
    summary: "Tick a step off, or reopen it",
    description:
      "Idempotent in both directions. Ticking an already-completed step changes nothing, so the first completer wins.",
    operationId: "updateStep",
    middleware: [authenticated, joinedGroup, stepInGroup] as const,
    request: {
      params: STEP_PARAMS,
      body: { required: true, content: jsonContent(UPDATE_STEP_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The step in its current state",
        content: jsonContent(NEXT_STEP_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only writers and administrators can tick steps",
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
    const { done } = c.req.valid("json");
    const user = c.get("user");

    if (!mayAct(c.get("group").role, "step:tick")) {
      return c.json(
        { error: "Only writers and administrators can tick steps" },
        STATUS_CODE.Forbidden,
      );
    }

    const updated = await db.transaction().execute((transaction) =>
      WritingGroupNextStepService.setCompleted(
        transaction,
        c.get("step").id,
        done,
        user.id,
      )
    );
    // Deleted between the check above and the update: a race, answered like any other miss.
    if (updated === undefined) {
      return c.json({ error: "Step not found" }, STATUS_CODE.NotFound);
    }
    return c.json(updated, STATUS_CODE.OK);
  },
);
