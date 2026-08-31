import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { notBlank } from "@/src/http/request_schema.ts";
import { STATUS_CODE } from "@std/http/status";
import { REPORTS_TAG } from "@/src/open_api_specification.ts";
import { REPORT_OUTCOME_SCHEMA, REPORT_SCHEMA } from "@/src/database/schema.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import authenticated from "@/src/middleware/authenticated.ts";
import { authorizedAsModerator } from "@/src/middleware/authorized_as_platform_role.ts";
import type { ReportMove } from "@/src/service/report_service.ts";
import { ReportService } from "@/src/service/report_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";

/**
 * A discriminated union rather than one flat shape with optional fields, so the document itself
 * says that a closing carries an outcome and a note and that taking one does not. A `refine` would
 * enforce the same rule invisibly — it does not survive into `open-api.json`, so the generated
 * client could not see it.
 */
const MOVE_REPORT_BODY = z.discriminatedUnion("status", [
  z.object({ status: z.literal("in_progress") }),
  z.object({
    status: z.literal("closed"),
    outcome: REPORT_OUTCOME_SCHEMA,
    // Required, for the reason the reporter's own `reason` is required beside their category: an
    // outcome on its own loses the detail that decided the case.
    note: notBlank(z.string().min(1).max(TEXT_LIMIT.reportClosingNote)),
  }),
]);

/** The body's own shape, minus the wire name for the status the report is moving to. */
function move(body: z.infer<typeof MOVE_REPORT_BODY>): ReportMove {
  switch (body.status) {
    case "in_progress":
      return { toStatus: "in_progress" };
    case "closed":
      return {
        toStatus: "closed",
        outcome: body.outcome,
        note: body.note,
      };
    default:
      return assertUnreachable(body);
  }
}

export default new OpenAPIHono().openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: [REPORTS_TAG],
    summary: "Take a report, or close it",
    description:
      "Takes a report so other operators know it is in hand, or closes it with an outcome and a note saying what was decided. Both are recorded on the report itself, and a closed report is final — there is no reopening. Taking one somebody else already has is allowed and hands it over, so a forgotten claim cannot strand a report; closing it is reserved to whoever holds it.",
    operationId: "moveReport",
    middleware: [authenticated, authorizedAsModerator] as const,
    request: {
      params: z.object({ reportId: REPORT_SCHEMA.shape.id }),
      body: { required: true, content: jsonContent(MOVE_REPORT_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The report has moved",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Not an operator",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such report",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Conflict]: {
        description:
          "The report is already closed, or another operator holds it and this is a closing. Refetching the queue shows the operator which of the two it was.",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { reportId } = c.req.valid("param");
    const body = c.req.valid("json");

    const refusal = await ReportService.moveReport(
      reportId,
      move(body),
      c.get("user").id,
    );

    switch (refusal) {
      case undefined:
        return c.json({ ok: true } as const, STATUS_CODE.OK);
      case "not_found":
        return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
      case "already_closed":
        return c.json({ error: "Already closed" }, STATUS_CODE.Conflict);
      case "held_by_another":
        return c.json(
          { error: "Another operator has this report" },
          STATUS_CODE.Conflict,
        );
      default:
        return assertUnreachable(refusal);
    }
  },
);
