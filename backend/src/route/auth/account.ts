import { OpenAPIHono } from "@hono/zod-openapi";
import confirmDeletion from "./account/confirm_deletion.ts";
import requestDeletion from "./account/request_deletion.ts";

// Asking and confirming are separate endpoints because their preconditions have nothing in
// common: one needs a session and the password, the other only the mailed token.
export default new OpenAPIHono()
  .route("/deletion", requestDeletion)
  .route("/deletion/confirm", confirmDeletion);
