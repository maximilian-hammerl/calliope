import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { STATUS_CODE } from "@std/http/status";
import { REPORTS_TAG } from "@/src/open_api_specification.ts";
import { REPORT_SCHEMA } from "@/src/database/schema.ts";
import authenticated from "@/src/middleware/authenticated.ts";
import { authorizedAsModerator } from "@/src/middleware/authorized_as_platform_role.ts";
import { ReportService } from "@/src/service/report_service.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
  OK_RESPONSE,
} from "@/src/http/response.ts";

const CLOSE_REPORT_BODY = z.object({
  // Only the two closings. Reopening is a different act and this does not offer it.
  status: REPORT_SCHEMA.shape.status.exclude(["open"]),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "patch",
    path: "/",
    tags: [REPORTS_TAG],
    summary: "Close a report as resolved or dismissed",
    description:
      "Records who closed it and when. `resolved` means something was done about it, `dismissed` means the report was not valid — the two are kept apart because which one an operator chose is the only signal about whether a member's reports are worth reading. Only an open report can be closed.",
    operationId: "closeReport",
    middleware: [authenticated, authorizedAsModerator] as const,
    request: {
      params: z.object({ reportId: REPORT_SCHEMA.shape.id }),
      body: { required: true, content: jsonContent(CLOSE_REPORT_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The report is closed",
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
        description: "No such report, or it is closed already",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const { reportId } = c.req.valid("param");
    const { status } = c.req.valid("json");

    const refusal = await ReportService.closeReport(
      reportId,
      status,
      c.get("user").id,
    );

    return refusal === "not_found"
      ? c.json({ error: "Not found" }, STATUS_CODE.NotFound)
      : c.json({ ok: true } as const, STATUS_CODE.OK);
  },
);
