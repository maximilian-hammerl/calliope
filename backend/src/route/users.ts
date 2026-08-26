import { OpenAPIHono } from "@hono/zod-openapi";
import listUsers from "./users/list_users.ts";
import me from "./users/me.ts";
import user from "./users/user.ts";

// `/me` before `/:userId`, or the parameter swallows it.
export default new OpenAPIHono()
  .route("/", listUsers)
  .route("/me", me)
  .route("/:userId", user);
