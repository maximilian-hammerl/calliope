import { OpenAPIHono } from "@hono/zod-openapi";
import listUsers from "./users/list_users.ts";
import updateOwnProfile from "./users/update_own_profile.ts";
import user from "./users/user.ts";

export default new OpenAPIHono()
  .route("/", listUsers)
  // Before the parameter, or `/me` is swallowed by `/:userId`.
  .route("/me", updateOwnProfile)
  .route("/:userId", user);
