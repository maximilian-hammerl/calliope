import { createMiddleware } from "hono/factory";
import { type User, UserService } from "@/src/service/user_service.ts";
import { SessionCookieService } from "@/src/service/session_cookie_service.ts";

export default createMiddleware<{
  Variables: { user: User };
}>(async (c, next) => {
  const sessionToken = SessionCookieService.getUserSession(c);

  if (sessionToken === undefined) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await UserService.selectUserForSession(sessionToken);

  if (user === undefined) {
    SessionCookieService.deleteUserSession(c);
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", user);

  await next();
});
