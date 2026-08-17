import { OpenAPIHono } from "@hono/zod-openapi";
import createMembership from "./memberships/create_membership.ts";
import listMemberships from "./memberships/list_memberships.ts";
import me from "./memberships/me.ts";
import membership from "./memberships/membership.ts";

// `/me` is mounted before `/:userId`, so the literal segment cannot be swallowed by the
// parameter — `me` is not a uuid and would otherwise only ever be a validation error.
export default new OpenAPIHono()
  .route("/", createMembership)
  .route("/", listMemberships)
  .route("/me", me)
  .route("/:userId", membership);
