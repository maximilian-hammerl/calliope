import { OpenAPIHono } from "@hono/zod-openapi";
import account from "./auth/account.ts";
import emailAddress from "./auth/email_address.ts";
import forgotPassword from "./auth/forgot_password.ts";
import login from "./auth/login.ts";
import logout from "./auth/logout.ts";
import me from "./auth/me.ts";
import password from "./auth/password.ts";
import register from "./auth/register.ts";
import sessions from "./auth/sessions.ts";
import resendEmailAddressVerification from "./auth/resend_email_address_verification.ts";
import resetPassword from "./auth/reset_password.ts";
import verifyEmailAddress from "./auth/verify_email_address.ts";

export default new OpenAPIHono()
  .route("/", register)
  .route("/", login)
  .route("/", logout)
  .route("/", me)
  .route("/", forgotPassword)
  .route("/", resetPassword)
  .route("/", verifyEmailAddress)
  .route("/", resendEmailAddressVerification)
  .route("/email-address", emailAddress)
  .route("/account", account)
  .route("/sessions", sessions)
  .route("/", password);
