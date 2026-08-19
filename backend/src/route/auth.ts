import { OpenAPIHono } from "@hono/zod-openapi";
import forgotPassword from "./auth/forgot_password.ts";
import login from "./auth/login.ts";
import logout from "./auth/logout.ts";
import me from "./auth/me.ts";
import register from "./auth/register.ts";
import resetPassword from "./auth/reset_password.ts";

export default new OpenAPIHono()
  .route("/", register)
  .route("/", login)
  .route("/", logout)
  .route("/", me)
  .route("/", forgotPassword)
  .route("/", resetPassword);
