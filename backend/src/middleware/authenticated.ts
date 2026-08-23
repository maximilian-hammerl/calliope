import { createMiddleware } from "hono/factory";
import type { User } from "@/src/service/user_service.ts";
import { resolveSessionUser } from "@/src/middleware/session_user.ts";

/**
 * A session *and* a verified email address — both, deliberately, and this is why the pair is
 * not split into two composable middlewares: a route that listed only the first half would
 * fail *open*, and there are sixty chances to make that mistake. Authorization composes on top
 * of this; authentication does not decompose below it.
 *
 * This is the default for every route: gating had
 * to be the thing you get by not thinking about it, because the alternative was adding a
 * second middleware to thirty-three files and every omission being a silent hole.
 *
 * 403 rather than 401: the session is perfectly good, so answering "unauthorised" would send
 * the client back to the sign-in page it just came from. The error names the reason, which is
 * what the interface reads to show the verification wall.
 */
export default createMiddleware<{
  Variables: { user: User };
}>(async (c, next) => {
  const user = await resolveSessionUser(c);

  if (user === undefined) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (user.emailAddressVerifiedAt === null) {
    return c.json({ error: "Email address not verified" }, 403);
  }

  c.set("user", user);

  await next();
  return;
});
