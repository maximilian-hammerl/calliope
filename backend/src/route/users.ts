import { OpenAPIHono } from "@hono/zod-openapi";
import listUsers from "./users/list_users.ts";
import user from "./users/user.ts";

export default new OpenAPIHono()
  .route("/", listUsers)
  .route("/:userId", user);
