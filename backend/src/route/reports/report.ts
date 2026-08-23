import { OpenAPIHono } from "@hono/zod-openapi";
import closeReport from "./report/close_report.ts";

export default new OpenAPIHono().route("/", closeReport);
