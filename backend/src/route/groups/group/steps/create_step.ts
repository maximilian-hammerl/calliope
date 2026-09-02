import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { notBlank } from "@/src/http/request_schema.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import { NEXT_STEP_RESPONSE } from "@/src/http/response_schema.ts";
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
} from "@/src/http/response.ts";
import {
  WRITING_GROUP_NEXT_STEP_SCHEMA,
  WRITING_GROUP_SCHEMA,
} from "@/src/database/schema.ts";

const GROUP_PARAMS = z.object({ groupId: WRITING_GROUP_SCHEMA.shape.id });

const CREATE_STEP_BODY = WRITING_GROUP_NEXT_STEP_SCHEMA
  .pick({ text: true })
  .extend({
    text: notBlank(
      WRITING_GROUP_NEXT_STEP_SCHEMA.shape.text.min(1).max(TEXT_LIMIT.stepText),
    ),
  });

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [STEPS_TAG],
    summary: "Add a next step",
    operationId: "createStep",
    middleware: authenticated,
    request: {
      params: GROUP_PARAMS,
      body: { required: true, content: jsonContent(CREATE_STEP_BODY) },
    },
    responses: {
      [STATUS_CODE.Created]: {
        description: "The step was added",
        content: jsonContent(NEXT_STEP_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Only writers and administrators can add steps",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such group, or it is private and not the user's",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { groupId } = c.req.valid("param");
    const { text } = c.req.valid("json");
    const user = c.get("user");

    const role = await WritingGroupService.selectRoleForUser(user, groupId);
    if (role === undefined) {
      return c.json({ error: "Group not found" }, STATUS_CODE.NotFound);
    }

    if (!mayAct(role, "step:create")) {
      return c.json(
        { error: "Only writers and administrators can add steps" },
        STATUS_CODE.Forbidden,
      );
    }

    const step = await WritingGroupNextStepService.insertStep(
      groupId,
      text,
      user.id,
    );
    return c.json(step, STATUS_CODE.Created);
  },
);
