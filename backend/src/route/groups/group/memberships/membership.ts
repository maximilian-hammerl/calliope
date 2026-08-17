import { OpenAPIHono } from "@hono/zod-openapi";
import deleteMembership from "./membership/delete_membership.ts";
import updateMembership from "./membership/update_membership.ts";

// Mounted by memberships.ts at /:userId.
export default new OpenAPIHono()
  .route("/", updateMembership)
  .route("/", deleteMembership);
