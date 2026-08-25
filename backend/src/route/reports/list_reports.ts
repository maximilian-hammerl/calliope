import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { listQuery } from "@/src/list/list_endpoint_query.ts";
import { STATUS_CODE } from "@std/http/status";
import { REPORTS_TAG } from "@/src/open_api_specification.ts";
import { REPORT_SCHEMA, USER_SCHEMA } from "@/src/database/schema.ts";
import authenticated from "@/src/middleware/authenticated.ts";
import { authorizedAsModerator } from "@/src/middleware/authorized_as_platform_role.ts";
import { ReportService } from "@/src/service/report_service.ts";
import {
  listQuerySchema,
  listResponseSchema,
} from "@/src/list/list_endpoint.ts";
import {
  BAD_REQUEST_RESPONSE,
  COMMON_RESPONSES,
  ERROR_RESPONSE,
  jsonContent,
} from "@/src/http/response.ts";

// Oldest first by default: a queue worked newest-first lets its bottom rot, and the oldest
// report is the one somebody has been waiting longest on.
const SORT_ATTRIBUTE = z
  .enum(["createdAt"])
  .default("createdAt")
  .transform((attribute) => `report.${attribute}` as const);

const LIST_REPORTS_BODY = listQuerySchema(
  SORT_ATTRIBUTE,
  {
    // No default: the queue asks for `open`, and everything else is somebody looking back.
    status: REPORT_SCHEMA.shape.status.optional(),
    category: REPORT_SCHEMA.shape.category.optional(),
    targetType: REPORT_SCHEMA.shape.targetType.optional(),
    // How it was closed, which is the filter that replaced asking for `resolved` or `dismissed`:
    // those two were one enum's worth of detail collapsed into a status, and the outcome says it
    // properly. Unwrapped because the column is nullable and an absent filter is not a request
    // for reports with no outcome.
    closingOutcome: REPORT_SCHEMA.shape.closingOutcome.unwrap().optional(),
  },
  "asc",
);

const REPORT_RESPONSE = REPORT_SCHEMA.pick({
  id: true,
  targetType: true,
  targetExcerpt: true,
  category: true,
  reason: true,
  status: true,
  createdAt: true,
  inProgressAt: true,
  closedAt: true,
  closingOutcome: true,
  closingNote: true,
}).extend({
  // Whoever is dealing with it, which on a closed report is whoever closed it. Null for a report
  // nobody has taken, and also for one whose operator has since deleted their account — the move
  // still happened, so the timestamp stays and only the name goes.
  operatorUsername: USER_SCHEMA.shape.username.nullable(),
  // Null once the reporter's account is gone; the report itself stays.
  reporterUsername: USER_SCHEMA.shape.username.nullable(),
  // Who is answerable for the reported thing, which is what an operator acts on — and which
  // survives the thing itself being deleted. Null only once that account is gone too.
  authorId: USER_SCHEMA.shape.id.nullable(),
  authorUsername: USER_SCHEMA.shape.username.nullable(),
  // Whether the thing it names is still there, which is the difference between "go and look"
  // and "already gone".
  targetExists: z.boolean(),
});

export default new OpenAPIHono().openapi(
  createRoute({
    method: "query",
    path: "/",
    tags: [REPORTS_TAG],
    summary: "List what members have reported",
    description:
      "The operators' queue. Oldest first, so nothing waits at the bottom, and filterable by status, category and target type. Each report carries what the reported thing said when it was reported, so it stays readable after the content is gone, and whether that thing still exists.",
    operationId: "listReports",
    middleware: [authenticated, authorizedAsModerator] as const,
    request: {
      body: { required: true, content: jsonContent(LIST_REPORTS_BODY) },
    },
    responses: {
      [STATUS_CODE.OK]: {
        description: "The reports, newest last",
        content: jsonContent(listResponseSchema(REPORT_RESPONSE)),
      },
      [STATUS_CODE.Unauthorized]: {
        description: "No valid session",
        content: jsonContent(ERROR_RESPONSE),
      },
      [STATUS_CODE.Forbidden]: {
        description: "Not an operator",
        content: jsonContent(ERROR_RESPONSE),
      },
      ...BAD_REQUEST_RESPONSE,
      ...COMMON_RESPONSES,
    },
  }),
  async (c) => {
    const page = await ReportService.listReports(
      listQuery(c.req.valid("json")),
    );
    return c.json(page, STATUS_CODE.OK);
  },
);
