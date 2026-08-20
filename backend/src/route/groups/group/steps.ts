import { OpenAPIHono } from "@hono/zod-openapi";
import createStep from "./steps/create_step.ts";
import listSteps from "./steps/list_steps.ts";
import step from "./steps/step.ts";

export default new OpenAPIHono()
  .route("/", createStep)
  .route("/", listSteps)
  .route("/:stepId", step);
