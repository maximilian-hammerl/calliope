import { OpenAPIHono } from "@hono/zod-openapi";
import createReport from "./reports/create_report.ts";

export default new OpenAPIHono().route("/", createReport);
