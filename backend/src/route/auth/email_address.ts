import { OpenAPIHono } from "@hono/zod-openapi";
import cancelChange from "./email_address/cancel_change.ts";
import confirmChange from "./email_address/confirm_change.ts";
import correctUnverifiedAddress from "./email_address/correct_unverified_address.ts";
import requestChange from "./email_address/request_change.ts";

// Correcting an address nobody has proven and changing one that is proven are deliberately
// different endpoints. They have different preconditions — the second needs the password —
// and one URL that behaves two ways is exactly the confusion this feature must not have.
export default new OpenAPIHono()
  .route("/", correctUnverifiedAddress)
  .route("/change", requestChange)
  .route("/confirm", confirmChange)
  .route("/cancel", cancelChange);
