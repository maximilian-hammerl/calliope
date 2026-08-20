import { OpenAPIHono } from "@hono/zod-openapi";
import deleteStep from "./step/delete_step.ts";
import updateStep from "./step/update_step.ts";

export default new OpenAPIHono()
  .route("/", updateStep)
  .route("/", deleteStep);
