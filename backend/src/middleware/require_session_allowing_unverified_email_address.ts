import { createMiddleware } from "hono/factory";
import type { User } from "@/src/service/user_service.ts";
import { resolveSessionUser } from "@/src/middleware/session_user.ts";

/**
 * A session, without asking whether the address behind it has been verified.
 *
 * Only for the handful of routes somebody has to reach *in order to* verify: reading who
 * they are, correcting a mistyped address, asking for another mail, and signing out. Every
 * other route uses `require_session.ts`, which is the strict default — a route that forgets
 * to choose gets the safe one.
 *
 * A test pins the set of files importing this, so widening it has to be deliberate.
 */
export default createMiddleware<{
  Variables: { user: User };
}>(async (c, next) => {
  const user = await resolveSessionUser(c);

  if (user === undefined) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", user);

  await next();
  return;
});
