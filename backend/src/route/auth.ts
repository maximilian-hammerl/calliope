import { OpenAPIHono } from "@hono/zod-openapi";
import login from "./auth/login.ts";
import logout from "./auth/logout.ts";
import me from "./auth/me.ts";
import register from "./auth/register.ts";

export default new OpenAPIHono()
  .route("/", register)
  .route("/", login)
  .route("/", logout)
  .route("/", me);
