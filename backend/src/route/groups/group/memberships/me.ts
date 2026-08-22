import { OpenAPIHono } from "@hono/zod-openapi";
import acceptInvitation from "./me/accept_invitation.ts";

// Mounted by memberships.ts at /me. Accepting stays addressed as `me` because nobody can accept
// an invitation on another member's behalf; leaving moved to DELETE …/memberships/{userId},
// which already had to answer for an administrator removing somebody.
export default new OpenAPIHono().route("/accept", acceptInvitation);
