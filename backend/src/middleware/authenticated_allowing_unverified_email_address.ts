import { createMiddleware } from "hono/factory";
import type { User } from "@/src/service/user_service.ts";
import { resolveSessionUser } from "@/src/middleware/session_user.ts";
import { ACCOUNT_BANNED_BODY } from "@/src/http/response.ts";

/**
 * A session, without asking whether the address behind it has been verified.
 *
 * Only for the routes somebody has to reach *in order to* verify — reading who they are,
 * correcting a mistyped address, asking for another mail, signing out — and the one they need
 * in order to leave without ever verifying: asking for deletion. Every other route uses
 * `require_session.ts`, which is the strict default, so a route that forgets to choose gets
 * the safe one.
 */
export default createMiddleware<{
  Variables: { user: User };
}>(async (c, next) => {
  const user = await resolveSessionUser(c);

  if (user === undefined) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Banned reaches nothing, this set included: these routes exist so somebody can verify or
  // leave, and a banned account is doing neither.
  if (user.bannedAt !== null) {
    return c.json(ACCOUNT_BANNED_BODY, 403);
  }

  c.set("user", user);

  await next();
  return;
});
