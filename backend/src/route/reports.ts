import { OpenAPIHono } from "@hono/zod-openapi";
import createReport from "./reports/create_report.ts";
import listReports from "./reports/list_reports.ts";
import report from "./reports/report.ts";

export default new OpenAPIHono()
  .route("/", createReport)
  .route("/", listReports)
  .route("/:reportId", report);
