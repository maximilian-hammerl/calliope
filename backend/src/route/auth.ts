import { OpenAPIHono } from "@hono/zod-openapi";
import emailAddress from "./auth/email_address.ts";
import forgotPassword from "./auth/forgot_password.ts";
import login from "./auth/login.ts";
import logout from "./auth/logout.ts";
import me from "./auth/me.ts";
import password from "./auth/password.ts";
import register from "./auth/register.ts";
import resendVerification from "./auth/resend_verification.ts";
import resetPassword from "./auth/reset_password.ts";
import verifyEmail from "./auth/verify_email.ts";

export default new OpenAPIHono()
  .route("/", register)
  .route("/", login)
  .route("/", logout)
  .route("/", me)
  .route("/", forgotPassword)
  .route("/", resetPassword)
  .route("/", verifyEmail)
  .route("/", resendVerification)
  .route("/email-address", emailAddress)
  .route("/", password);
