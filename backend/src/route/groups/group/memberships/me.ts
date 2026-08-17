import { OpenAPIHono } from "@hono/zod-openapi";
import acceptInvitation from "./me/accept_invitation.ts";
import leaveGroup from "./me/leave_group.ts";

// Mounted by memberships.ts at /me.
export default new OpenAPIHono()
  .route("/accept", acceptInvitation)
  .route("/leave", leaveGroup);
