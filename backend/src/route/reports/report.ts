import { OpenAPIHono } from "@hono/zod-openapi";
import moveReport from "./report/move_report.ts";

export default new OpenAPIHono().route("/", moveReport);
