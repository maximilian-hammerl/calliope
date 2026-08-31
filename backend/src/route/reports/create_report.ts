import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { notBlank } from "@/src/http/request_schema.ts";
import { STATUS_CODE } from "@std/http/status";
import { REPORTS_TAG } from "@/src/open_api_specification.ts";
import { REPORT_SCHEMA } from "@/src/database/schema.ts";
import { TEXT_LIMIT } from "@/src/text_limit.ts";
import authenticated from "@/src/middleware/authenticated.ts";
import { ReportService } from "@/src/service/report_service.ts";
import { assertUnreachable } from "@/src/util/assert_unreachable.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  FORBIDDEN_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

const CREATE_REPORT_BODY = z.object({
  targetType: REPORT_SCHEMA.shape.targetType,
  targetId: REPORT_SCHEMA.shape.id,
  // Both, not either: the category is what the queue filters on, the reason is what decides
  // the case.
  category: REPORT_SCHEMA.shape.category,
  reason: notBlank(z.string().min(1).max(TEXT_LIMIT.reportReason)),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "post",
    path: "/",
    tags: [REPORTS_TAG],
    summary: "Report something to the operators",
    description:
      "Files a report about a writing group, thread or post, a story idea, a chat or one of its messages, or a member. Only something the reporter can already see may be reported, and anything else answers 404 — so a report cannot be used to find out whether something exists. Reporting one's own account or one's own writing answers 403. What the reported thing said is copied into the report by the server, so the report is still readable to an operator after the content is deleted. Reporting the same thing again while the first report is still open rewrites its category and reason rather than filing a second.",
    operationId: "createReport",
    middleware: authenticated,
    request: {
      body: { required: true, content: jsonContent(CREATE_REPORT_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The report has been filed",
        content: jsonContent(OK_RESPONSE),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.NotFound]: {
        description: "No such thing, or the reporter may not see it",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...FORBIDDEN_RESPONSE,
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { targetType, targetId, category, reason } = c.req.valid("json");

    const refusal = await ReportService.insertReport(
      c.get("user"),
      targetType,
      targetId,
      category,
      reason,
    );

    switch (refusal) {
      case "not_found":
        return c.json({ error: "Not found" }, STATUS_CODE.NotFound);
      case "own_account":
        return c.json(
          { error: "You cannot report your own account" },
          STATUS_CODE.Forbidden,
        );
      case "own_content":
        return c.json(
          { error: "You cannot report your own content" },
          STATUS_CODE.Forbidden,
        );
      case undefined:
        return c.json({ ok: true } as const, STATUS_CODE.OK);
      default:
        return assertUnreachable(refusal);
    }
  },
);
